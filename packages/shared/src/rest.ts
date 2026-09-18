import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const credentialsBody = z
  .object({
    username: z.string().trim().min(1, "Username and password are required"),
    password: z.string().min(1, "Username and password are required"),
    altcha: z.string().optional(),
  })
  .openapi("CredentialsBody");

export const signupBody = z
  .object({
    username: z.string().trim().min(1, "Missing required fields"),
    firstName: z.string().trim().min(1, "Missing required fields"),
    lastName: z.string().trim().min(1, "Missing required fields"),
    password: z.string().min(1, "Missing required fields"),
    altcha: z.string().optional(),
  })
  .openapi("SignupBody");

export const refreshBody = z
  .object({
    refreshToken: z.string().min(1, "refreshToken required"),
  })
  .openapi("RefreshBody");

export const logoutBody = z
  .object({
    refreshToken: z.string().optional(),
  })
  .openapi("LogoutBody");

export const forgotPasswordBody = z
  .object({
    email: z.string().trim().min(1, "Email is required").transform((value) => value.toLowerCase()),
  })
  .openapi("ForgotPasswordBody");

export const resetPasswordBody = z
  .object({
    token: z.string().min(1, "Token and a password of at least 8 characters are required"),
    password: z.string().min(8, "Token and a password of at least 8 characters are required"),
  })
  .openapi("ResetPasswordBody");

export const patchMeBody = z
  .object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phoneNumber: z.string().optional(),
  })
  .openapi("PatchMeBody");

export const patchAdminUserBody = z
  .object({
    role: z.enum(["user", "shop", "superadmin", "sales", "marketing"], {
      errorMap: () => ({ message: "You cannot assign that role" }),
    }),
  })
  .openapi("PatchAdminUserBody");

export const checkoutBody = z
  .object({
    bookId: z.string().min(1, "bookId is required"),
    quantity: z.coerce.number().int().min(1).default(1),
  })
  .openapi("CheckoutBody");

export const createStoreBody = z
  .object({
    name: z.string().trim().min(1, "Store name is required"),
  })
  .openapi("CreateStoreBody");

export const createApiKeyBody = z
  .object({
    name: z.string().trim().optional(),
  })
  .openapi("CreateApiKeyBody");
