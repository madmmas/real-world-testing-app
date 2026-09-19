import "./env.js";
import express from "express";
import session from "express-session";
import pg from "pg";
import connectPgSimple from "connect-pg-simple";
import { publicCors } from "@rwa/service-kit";
import { env } from "./env.js";
import { authRouter } from "./routes.js";
import { initCaptcha } from "./captcha.js";

const app = express();
app.set("trust proxy", 1);
const PgStore = connectPgSimple(session);
const pool = new pg.Pool({ connectionString: env.databaseUrl });

app.use(
  publicCors(env.webOrigin, env.adminOrigin)
);
app.use(express.json());
app.use(
  session({
    name: "rwa.admin.sid",
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: "auto",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
    store: new PgStore({
      pool,
      createTableIfMissing: true,
    }),
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "auth" });
});

app.use("/auth", authRouter);

await initCaptcha();
app.listen(env.port, () => {
  console.log(`Auth service listening on http://localhost:${env.port}`);
});
