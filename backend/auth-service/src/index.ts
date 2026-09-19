import "./env.js";
import express from "express";
import session from "express-session";
import pg from "pg";
import connectPgSimple from "connect-pg-simple";
import { createService, publicCors } from "@rwa/service-kit";
import { env } from "./env.js";
import { authRouter } from "./routes.js";
import { initCaptcha } from "./captcha.js";
import { mountUserRoutes } from "./users.js";

const app = createService("auth");
app.set("trust proxy", 1);
const PgStore = connectPgSimple(session);
const pool = new pg.Pool({ connectionString: env.databaseUrl });

app.use(publicCors(env.webOrigin, env.adminOrigin));
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

app.use("/auth", authRouter);
mountUserRoutes(app);

await initCaptcha();
app.listen(env.port, () => {
  console.log(`Auth service listening on http://localhost:${env.port}`);
});
