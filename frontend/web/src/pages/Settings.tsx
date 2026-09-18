import { FormEvent, useState } from "react";
import { useAuth } from "../auth";

export default function Settings() {
  const { user, apiJson, setUser } = useAuth();
  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    phoneNumber: user?.phoneNumber ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    setError("");
    try {
      const data = await apiJson<{ user: NonNullable<typeof user> }>("/me", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setUser(data.user);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings");
    }
  }

  return (
    <form className="space-y-3 rounded-xl bg-white p-6 shadow" onSubmit={(e) => void onSubmit(e)}>
      <h2 className="text-xl font-semibold">User settings</h2>
      {(["firstName", "lastName", "email", "phoneNumber"] as const).map((field) => (
        <label key={field} className="block text-sm capitalize">
          {field.replace(/([A-Z])/g, " $1")}
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={form[field]}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
          />
        </label>
      ))}
      <button className="rounded-md bg-blue-600 px-4 py-2 text-white" type="submit">
        Save
      </button>
      {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">Saved.</p>}
    </form>
  );
}
