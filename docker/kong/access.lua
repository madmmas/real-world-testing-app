-- Kong access-phase auth. Public /auth, /config, Stripe webhooks skip.
-- GraphQL and /cart: anonymous allowed; JWT must be valid if sent.
-- Other routes: access JWT required (partner keys are GraphQL-only).

local cjson = require "cjson.safe"

local JWT_SECRET = (os.getenv("JWT_SECRET") or ""):gsub("^%s+", ""):gsub("%s+$", "")
local JWT_ISSUER = (os.getenv("JWT_ISSUER") or "rwa-auth"):gsub("^%s+", ""):gsub("%s+$", "")
local JWT_AUDIENCE = (os.getenv("JWT_AUDIENCE") or "rwa"):gsub("^%s+", ""):gsub("%s+$", "")
local INTERNAL_SECRET = (os.getenv("INTERNAL_SERVICE_SECRET") or ""):gsub("^%s+", ""):gsub("%s+$", "")

local function exit(status, body)
  return kong.response.exit(status, body, { ["Content-Type"] = "application/json" })
end

local function auth_mode(path)
  if path:find("^/auth") then
    return "skip"
  end
  if path == "/config" or path:find("^/config/") then
    return "skip"
  end
  if path:find("^/api/stripe") then
    return "skip"
  end
  if path == "/graphql" or path:find("^/graphql/") then
    return "optional"
  end
  if path == "/cart" or path:find("^/cart/") then
    return "optional"
  end
  return "required"
end

local function bearer_token()
  local header = kong.request.get_header("authorization")
  if not header then
    return nil
  end
  return header:match("^[Bb]earer%s+(.+)$")
end

local function verify_jwt(token)
  if JWT_SECRET == "" then
    return nil, "token_invalid"
  end
  local ok, jwt_decoder = pcall(require, "kong.plugins.jwt.jwt_parser")
  if not ok then
    return nil, "token_invalid"
  end
  local jwt, err = jwt_decoder:new(token)
  if err or not jwt then
    return nil, "token_invalid"
  end
  local ok_sig, verified = pcall(function()
    return jwt:verify_signature(JWT_SECRET)
  end)
  if not ok_sig or not verified then
    return nil, "token_invalid"
  end
  local claims = jwt.claims or {}
  if claims.iss ~= JWT_ISSUER then
    return nil, "token_invalid"
  end
  local aud = claims.aud
  if type(aud) == "table" then
    local match = false
    for i = 1, #aud do
      if aud[i] == JWT_AUDIENCE then
        match = true
        break
      end
    end
    if not match then
      return nil, "token_invalid"
    end
  elseif aud ~= JWT_AUDIENCE then
    return nil, "token_invalid"
  end
  if claims.typ ~= "access" then
    return nil, "token_invalid"
  end
  local now = ngx.now()
  if claims.exp and (claims.exp + 5) < now then
    return nil, "token_expired"
  end
  if claims.nbf and (claims.nbf - 5) > now then
    return nil, "token_invalid"
  end
  return claims
end

local function validate_api_key(key)
  local ok_http, http = pcall(require, "resty.http")
  if not ok_http then
    return false
  end
  local httpc = http.new()
  httpc:set_timeout(2000)
  local res, err = httpc:request_uri("http://api-key-service:3009/internal/validate", {
    method = "POST",
    body = cjson.encode({ key = key }),
    headers = {
      ["Content-Type"] = "application/json",
      ["x-internal-secret"] = INTERNAL_SECRET,
    },
  })
  if err or not res then
    return false
  end
  return res.status == 200
end

if kong.request.get_method() == "OPTIONS" then
  return
end

local path = kong.request.get_path()
local mode = auth_mode(path)
if mode == "skip" then
  return
end

local api_key = kong.request.get_header("x-api-key")
local bearer = bearer_token()
if bearer and bearer:sub(1, 9) == "rwa_live_" then
  api_key = api_key or bearer
  bearer = nil
end

if api_key and api_key ~= "" then
  if mode == "required" then
    return exit(401, { error = "API keys can only search books", code = "token_invalid" })
  end
  if not validate_api_key(api_key) then
    return exit(401, { error = "Invalid API key", code = "token_invalid" })
  end
  return
end

if bearer and bearer ~= "" then
  local _, verr = verify_jwt(bearer)
  if verr == "token_expired" then
    return exit(401, { error = "Token expired", code = "token_expired" })
  end
  if verr then
    return exit(401, { error = "Invalid token", code = "token_invalid" })
  end
  return
end

if mode == "required" then
  return exit(401, { error = "Missing bearer token", code = "token_invalid" })
end
