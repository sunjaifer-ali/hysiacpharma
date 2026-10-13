import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addWebUser, ensureDefaultAdmin, readWebSession, removeWebUser, setWebPassword, useWebUsers, type WebRole } from "@/lib/web-users";
import { toast } from "sonner";

export function WebUsersCard() {
  const users = useWebUsers();
  const session = readWebSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<WebRole>("billing");
  const [ownPassword, setOwnPassword] = useState("");

  useEffect(() => {
    void ensureDefaultAdmin();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>
          Sign-in is a user name and password. A billing user can enter invoices and products only. They cannot open reports, accounts, purchases, payments or settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y divide-border rounded-xl border border-border">
          {users.map((user) => (
            <li key={user.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{user.username}</span>
                <span className="ml-2 text-muted-foreground">{user.role === "admin" ? "Full access" : "Billing and products"}</span>
              </span>
              {user.id !== "admin" && user.id !== session?.id ? (
                <Button variant="outline" size="sm" onClick={() => removeWebUser(user.id)}>
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-user">New user name</Label>
            <Input id="new-user" value={username} autoComplete="off" onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pass">Password</Label>
            <Input id="new-pass" type="password" value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={role === "billing"} onChange={(e) => setRole(e.target.checked ? "billing" : "admin")} />
          Billing and products only
        </label>
        <Button
          type="button"
          onClick={() => {
            void addWebUser(username, password, role).then((error) => {
              if (error) {
                toast.error(error);
                return;
              }
              setUsername("");
              setPassword("");
              toast.success("User added");
            });
          }}
        >
          Add user
        </Button>
        <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="own-pass">Change my password</Label>
            <Input id="own-pass" type="password" value={ownPassword} autoComplete="new-password" onChange={(e) => setOwnPassword(e.target.value)} />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!session) return;
              void setWebPassword(session.id, ownPassword).then((error) => {
                if (error) {
                  toast.error(error);
                  return;
                }
                setOwnPassword("");
                toast.success("Password changed. Sign in with it next time.");
              });
            }}
          >
            Save password
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">The first sign-in is admin / admin. Change that password before other people use this computer.</p>
      </CardContent>
    </Card>
  );
}
