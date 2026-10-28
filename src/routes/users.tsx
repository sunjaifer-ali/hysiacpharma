import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { staffAdd, staffList, staffRemove, staffSetPassword, type StaffPublic, type StaffRole } from "@/lib/staff-accounts";
import { useStaffSession } from "@/lib/staff-session";
import { toast } from "sonner";

export const Route = createFileRoute("/users")({ component: UsersPage });

function UsersPage() {
  const { session } = useStaffSession();
  const [users, setUsers] = useState<StaffPublic[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("billing");
  const [currentPassword, setCurrentPassword] = useState("");
  const [ownPassword, setOwnPassword] = useState("");

  function reload() {
    void staffList().then(setUsers).catch(() => setUsers([]));
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="font-display text-3xl">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a user name and password. The same account works on a phone, a tablet, a laptop and a desktop.
        </p>
      </div>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Change admin password</CardTitle>
          <CardDescription>Use at least 8 characters. The word admin is not allowed.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="current-pass">Current password</Label>
            <Input id="current-pass" type="password" value={currentPassword} autoComplete="current-password" className="h-11" onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="own-pass">New password</Label>
            <Input id="own-pass" type="password" value={ownPassword} autoComplete="new-password" className="h-11" onChange={(e) => setOwnPassword(e.target.value)} />
          </div>
          <Button
            type="button"
            className="h-11 sm:col-span-2 sm:w-fit"
            onClick={() => {
              if (!session) return;
              void staffSetPassword({ data: { id: session.id, password: ownPassword, currentPassword } }).then((result) => {
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                setCurrentPassword("");
                setOwnPassword("");
                toast.success("Password changed. Use it the next time you sign in.");
              });
            }}
          >
            Save new password
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Add a user</CardTitle>
          <CardDescription>
            Billing and products can enter invoices, quotations, returns, credit notes, products and parties. Full access can also open purchases, payments, reports, accounts and settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y divide-border rounded-xl border border-border">
            {users.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">No other users yet. Admin is already created.</li>
            ) : (
              users.map((user) => (
                <li key={user.id} className="flex flex-col gap-2 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <span className="font-medium">{user.username}</span>
                    <span className="ml-2 text-muted-foreground">{user.role === "admin" ? "Full access" : "Billing and products"}</span>
                  </span>
                  {user.id !== session?.id ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void staffRemove({ data: { id: user.id } }).then((result) => {
                          if (!result.ok) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success("User removed");
                          reload();
                        });
                      }}
                    >
                      Remove
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Signed in</span>
                  )}
                </li>
              ))
            )}
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-user">New user name</Label>
              <Input id="new-user" value={username} autoComplete="off" className="h-11" onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pass">Password</Label>
              <Input id="new-pass" type="password" value={password} autoComplete="new-password" className="h-11" onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button type="button" variant={role === "billing" ? "default" : "outline"} className="h-11" onClick={() => setRole("billing")}>
              Billing and products
            </Button>
            <Button type="button" variant={role === "admin" ? "default" : "outline"} className="h-11" onClick={() => setRole("admin")}>
              Full access
            </Button>
          </div>
          <Button
            type="button"
            className="h-11 w-full sm:w-auto"
            onClick={() => {
              void staffAdd({ data: { username, password, role } }).then((result) => {
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                setUsername("");
                setPassword("");
                toast.success("User added. They can sign in on any device.");
                reload();
              });
            }}
          >
            Add user
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
