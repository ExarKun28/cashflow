 import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Building2, Users, Plus, Pencil, Trash2, Star } from "lucide-react";

interface ProfileView {
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
  branchId: number | null;
  branchName: string;
  branchLocation: string;
  branchStatus: string;
  orgId: string | null;
  orgName: string | null;
}

interface Branch {
  id: number;
  name: string;
  address: string | null;
}

interface OrgUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  branchId: number | null;
  branchName: string | null;
}

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="text-lg font-medium text-foreground">{value}</p>
  </div>
);

const PASSWORD_MIN_LENGTH = 8;

type PendingAction =
  | {
      type: "account";
      payload: {
        newFullName: string | null;
        newEmail: string | null;
      };
    }
  | {
      type: "password";
      payload: {
        newPassword: string;
      };
    };

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState({
    fullName: "",
    email: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmationPassword, setConfirmationPassword] = useState("");
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Admin Panel State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Branch Dialog State
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState({ name: "", address: "" });
  const [savingBranch, setSavingBranch] = useState(false);

  // User Dialog State
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<OrgUser | null>(null);
  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    password: "",
    branchId: "",
  });
  const [savingUser, setSavingUser] = useState(false);

  const isAdmin = profile?.role === "admin";

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(authError.message);
      }

      if (!user) {
        throw new Error("You must be logged in to view your profile");
      }

      setUserId(user.id);
      setAuthEmail(user.email ?? null);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("email, full_name, role, branch_id, created_at, org_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profileData) {
        throw new Error(profileError?.message ?? "Profile not found");
      }

      let branchName = "Unassigned";
      let branchLocation = "N/A";
      let branchStatus = "N/A";

      if (profileData.branch_id) {
        const { data: branchData, error: branchError } = await supabase
          .from("branches")
          .select("name, address")
          .eq("id", profileData.branch_id)
          .single();

        if (!branchError && branchData) {
          branchName = branchData.name ?? "Unnamed Branch";
          branchLocation = branchData.address ?? "N/A";
          branchStatus = "Active";
        } else if (branchError) {
          console.error("Unable to load branch info", branchError);
        }
      }

      // Get organization name
      let orgName = null;
      if (profileData.org_id) {
        const { data: orgData, error: orgError } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", profileData.org_id)
          .single();

        if (!orgError && orgData) {
          orgName = orgData.name;
        }
      }

      setProfile({
        fullName: profileData.full_name ?? "Unnamed User",
        email: profileData.email ?? user.email ?? "unknown@example.com",
        role: profileData.role ?? "user",
        createdAt: profileData.created_at ?? new Date().toISOString(),
        branchId: profileData.branch_id ?? null,
        branchName,
        branchLocation,
        branchStatus,
        orgId: profileData.org_id ?? null,
        orgName,
      });
    } catch (fetchError) {
      const description =
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load profile";
      setError(description);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    if (!profile?.orgId) return;

    setLoadingBranches(true);
    try {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, address")
        .eq("org_id", profile.orgId)
        .order("name");

      if (error) throw error;
      setBranches(data || []);
    } catch (err) {
      console.error("Error loading branches:", err);
      toast.error("Failed to load branches");
    } finally {
      setLoadingBranches(false);
    }
  }, [profile?.orgId]);

  const loadOrgUsers = useCallback(async () => {
    if (!profile?.orgId) return;

    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, branch_id")
        .eq("org_id", profile.orgId)
        .order("full_name");

      if (error) throw error;

      const usersWithBranch = await Promise.all(
        (data || []).map(async (user) => {
          let branchName = null;
          if (user.branch_id) {
            const { data: branchData } = await supabase
              .from("branches")
              .select("name")
              .eq("id", user.branch_id)
              .single();
            branchName = branchData?.name || null;
          }
          return {
            id: user.id,
            fullName: user.full_name || "Unnamed User",
            email: user.email || "No email",
            role: user.role || "user",
            branchId: user.branch_id,
            branchName,
          };
        })
      );

      setOrgUsers(usersWithBranch);
    } catch (err) {
      console.error("Error loading users:", err);
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  }, [profile?.orgId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (profile) {
      setAccountForm({
        fullName: profile.fullName,
        email: profile.email,
      });
    }
  }, [profile]);

  useEffect(() => {
    if (isAdmin && profile?.orgId) {
      loadBranches();
      loadOrgUsers();
    }
  }, [isAdmin, profile?.orgId, loadBranches, loadOrgUsers]);

  // Branch handlers
  const openAddBranchDialog = () => {
    setEditingBranch(null);
    setBranchForm({ name: "", address: "" });
    setBranchDialogOpen(true);
  };

  const openEditBranchDialog = (branch: Branch) => {
    setEditingBranch(branch);
    setBranchForm({ name: branch.name, address: branch.address || "" });
    setBranchDialogOpen(true);
  };

  const handleSaveBranch = async () => {
    if (!branchForm.name.trim()) {
      toast.error("Branch name is required");
      return;
    }

    if (!profile?.orgId) {
      toast.error("Organization not found");
      return;
    }

    setSavingBranch(true);
    try {
      if (editingBranch) {
        const { error } = await supabase
          .from("branches")
          .update({ name: branchForm.name, address: branchForm.address || null })
          .eq("id", editingBranch.id);

        if (error) throw error;
        toast.success("Branch updated successfully");
      } else {
        const { error } = await supabase.from("branches").insert({
          name: branchForm.name,
          address: branchForm.address || null,
          org_id: profile.orgId,
        });

        if (error) throw error;
        toast.success("Branch created successfully");
      }

      setBranchDialogOpen(false);
      loadBranches();
    } catch (err) {
      console.error("Error saving branch:", err);
      toast.error("Failed to save branch");
    } finally {
      setSavingBranch(false);
    }
  };

  const handleDeleteBranch = async (branchId: number) => {
    if (!confirm("Are you sure you want to delete this branch?")) return;

    try {
      const { error } = await supabase.from("branches").delete().eq("id", branchId);

      if (error) throw error;
      toast.success("Branch deleted successfully");
      loadBranches();
    } catch (err) {
      console.error("Error deleting branch:", err);
      toast.error("Failed to delete branch");
    }
  };

  // User handlers
  const openAddUserDialog = () => {
    setEditingUser(null);
    setUserForm({ fullName: "", email: "", password: "", branchId: "" });
    setUserDialogOpen(true);
  };

  const openEditUserDialog = (user: OrgUser) => {
    setEditingUser(user);
    setUserForm({
      fullName: user.fullName,
      email: user.email,
      password: "",
      branchId: user.branchId?.toString() || "",
    });
    setUserDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!userForm.fullName.trim() || !userForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    if (!profile?.orgId) {
      toast.error("Organization not found");
      return;
    }

    setSavingUser(true);
    try {
      if (editingUser) {
        // Update existing user
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: userForm.fullName,
            branch_id: userForm.branchId && userForm.branchId !== "unassigned" ? parseInt(userForm.branchId) : null,
          })
          .eq("id", editingUser.id);

        if (error) throw error;
        toast.success("User updated successfully");
      } else {
        // Create new user
        if (!userForm.password || userForm.password.length < 6) {
          toast.error("Password must be at least 6 characters");
          setSavingUser(false);
          return;
        }

        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: userForm.email,
          password: userForm.password,
        });

        if (authError) throw authError;

        if (authData.user) {
          // Update the profile
          const { error: profileError } = await supabase
            .from("profiles")
            .update({
              full_name: userForm.fullName,
              email: userForm.email,
              role: "user",
              org_id: profile.orgId,
              branch_id: userForm.branchId ? parseInt(userForm.branchId) : null,
            })
            .eq("id", authData.user.id);

          if (profileError) throw profileError;
        }

        toast.success("User created successfully");
      }

      setUserDialogOpen(false);
      loadOrgUsers();
    } catch (err) {
      console.error("Error saving user:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSavingUser(false);
    }
  };

  const requestConfirmation = (action: PendingAction) => {
    setPendingAction(action);
    setConfirmDialogOpen(true);
    setConfirmationPassword("");
    setConfirmationError(null);
  };

  const resetConfirmationState = () => {
    setConfirmDialogOpen(false);
    setPendingAction(null);
    setConfirmationPassword("");
    setConfirmationError(null);
  };

  const handleConfirmDialogChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (confirming) {
        return;
      }
      resetConfirmationState();
      return;
    }

    setConfirmDialogOpen(true);
  };

  const handleAccountSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userId || !profile) {
      toast.error("Unable to update account", {
        description: "You must be signed in to perform this action",
      });
      return;
    }

    const trimmedFullName = accountForm.fullName.trim();
    const wantsFullNameChange =
      trimmedFullName.length > 0 && trimmedFullName !== profile.fullName;

    if (!wantsFullNameChange) {
      toast.info("No account changes detected");
      return;
    }

    requestConfirmation({
      type: "account",
      payload: {
        newFullName: wantsFullNameChange ? trimmedFullName : null,
        newEmail: null,
      },
    });
  };

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userId || !profile) {
      toast.error("Unable to update password", {
        description: "You must be signed in to perform this action",
      });
      return;
    }

    const { newPassword, confirmPassword } = passwordForm;

    if (!newPassword.trim() || !confirmPassword.trim()) {
      toast.error("Password fields cannot be empty");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Password entries do not match");
      return;
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      toast.error(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`
      );
      return;
    }

    requestConfirmation({
      type: "password",
      payload: { newPassword },
    });
  };

  const executePendingAction = async () => {
    if (!pendingAction || !profile) {
      toast.error("No action to confirm");
      return;
    }

    const secret = confirmationPassword.trim();
    if (!secret) {
      setConfirmationError("Password is required");
      return;
    }

    const reauthEmail = authEmail ?? profile.email;
    if (!reauthEmail) {
      setConfirmationError("Unable to determine account email");
      return;
    }

    setConfirming(true);
    setConfirmationError(null);

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: reauthEmail,
      password: secret,
    });

    if (verifyError) {
      setConfirmationError(verifyError.message);
      setConfirming(false);
      return;
    }

    const actionType = pendingAction.type;

    try {
      if (pendingAction.type === "account") {
        setSavingAccount(true);
        const { newFullName, newEmail } = pendingAction.payload;

        if (newEmail) {
          const { error: authUpdateError } = await supabase.auth.updateUser({
            email: newEmail,
          });

          if (authUpdateError) {
            throw new Error(authUpdateError.message);
          }
        }

        const profileUpdates: Record<string, string> = {};
        if (newFullName) {
          profileUpdates.full_name = newFullName;
        }
        if (newEmail) {
          profileUpdates.email = newEmail;
        }

        if (Object.keys(profileUpdates).length > 0 && userId) {
          const { error: profileError } = await supabase
            .from("profiles")
            .update(profileUpdates)
            .eq("id", userId);

          if (profileError) {
            throw new Error(profileError.message);
          }
        }

        toast.success("Account details updated");
        await loadProfile();
      } else {
        setSavingPassword(true);
        const { newPassword } = pendingAction.payload;
        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (passwordError) {
          throw new Error(passwordError.message);
        }

        toast.success("Password updated successfully");
        setPasswordForm({ newPassword: "", confirmPassword: "" });
      }

      resetConfirmationState();
    } catch (actionError) {
      const description =
        actionError instanceof Error ? actionError.message : "Unexpected error";

      if (actionType === "account") {
        toast.error("Unable to update account", { description });
      } else {
        toast.error("Unable to update password", { description });
      }
    } finally {
      if (actionType === "account") {
        setSavingAccount(false);
      } else {
        setSavingPassword(false);
      }
      setConfirming(false);
    }
  };

  const confirmationTitle =
    pendingAction?.type === "account"
      ? "Confirm Account Changes"
      : pendingAction?.type === "password"
      ? "Confirm Password Update"
      : "Confirm Action";

  const confirmationDescription =
    pendingAction?.type === "account"
      ? "Enter your current password to apply these account changes."
      : pendingAction?.type === "password"
      ? "Enter your current password to update it."
      : "Enter your current password to continue.";

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto py-8 px-4 space-y-8">
          <div className="flex flex-col justify-between mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Profile</h1>
            <p className="text-muted-foreground">Account Overview</p>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-muted-foreground">
              Loading your profile...
            </div>
          ) : !profile ? (
            <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-muted-foreground">
              No profile details available.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Account Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <InfoRow label="Full Name" value={profile.fullName} />
                      <InfoRow label="Email" value={profile.email} />
                      <InfoRow
                         label="Role"
                         value={profile.role === "admin" ? "admin ⭐" : profile.role}
                       />
                      <InfoRow
                        label="Member Since"
                        value={formatDate(profile.createdAt)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>
                      {isAdmin ? "Organization Info" : "Branch Assignment"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isAdmin ? (
                      <>
                        <InfoRow
                          label="Business Name"
                          value={profile.orgName || "Not set"}
                        />
                        <InfoRow
                          label="Your Role"
                          value="Administrator"
                        />
                        <InfoRow
                          label="Total Branches"
                          value={branches.length.toString()}
                        />
                        <InfoRow
                          label="Total Users"
                          value={orgUsers.length.toString()}
                        />
                      </>
                    ) : (
                      <>
                        <InfoRow label="Branch" value={profile.branchName} />
                        <InfoRow label="Location" value={profile.branchLocation} />
                        <InfoRow label="Status" value={profile.branchStatus} />
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Admin Panel - Manage Branches */}
              {isAdmin && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      <CardTitle>Manage Branches</CardTitle>
                    </div>
                    <Button onClick={openAddBranchDialog} size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Add Branch
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {loadingBranches ? (
                      <p className="text-muted-foreground">Loading branches...</p>
                    ) : branches.length === 0 ? (
                      <p className="text-muted-foreground">
                        No branches yet. Click "Add Branch" to create one.
                      </p>
                    ) : (
                      <div className="rounded-md border">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="px-4 py-3 text-left text-sm font-medium">
                                Branch Name
                              </th>
                              <th className="px-4 py-3 text-left text-sm font-medium">
                                Address
                              </th>
                              <th className="px-4 py-3 text-right text-sm font-medium">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {branches.map((branch) => (
                              <tr key={branch.id} className="border-b last:border-0">
                                <td className="px-4 py-3 text-sm">{branch.name}</td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                  {branch.address || "N/A"}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditBranchDialog(branch)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteBranch(branch.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Admin Panel - Manage Users */}
              {isAdmin && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      <CardTitle>Manage Users</CardTitle>
                    </div>
                    <Button onClick={openAddUserDialog} size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Add User
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {loadingUsers ? (
                      <p className="text-muted-foreground">Loading users...</p>
                    ) : orgUsers.length === 0 ? (
                      <p className="text-muted-foreground">
                        No users yet. Click "Add User" to create one.
                      </p>
                    ) : (
                      <div className="rounded-md border">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="px-4 py-3 text-left text-sm font-medium">
                                Name
                              </th>
                              <th className="px-4 py-3 text-left text-sm font-medium">
                                Email
                              </th>
                              <th className="px-4 py-3 text-left text-sm font-medium">
                                Role
                              </th>
                              <th className="px-4 py-3 text-left text-sm font-medium">
                                Branch
                              </th>
                              <th className="px-4 py-3 text-right text-sm font-medium">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {orgUsers.map((user) => (
                              <tr key={user.id} className="border-b last:border-0">
                                <td className="px-4 py-3 text-sm">
                                  {user.fullName}
                                  {user.id === userId && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      (You)
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                  {user.email}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {user.role === "admin" ? (
                                    <span className="inline-flex items-center gap-1 text-yellow-600">
                                      admin <Star className="h-3 w-3 fill-yellow-500" />
                                    </span>
                                  ) : (
                                    user.role
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                  {user.branchName || "Unassigned"}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditUserDialog(user)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Edit Account</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Update your name. Email changes are temporarily disabled
                      while confirmation emails are offline.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-4" onSubmit={handleAccountSubmit}>
                      <div className="space-y-2">
                        <Label htmlFor="newFullName">New Full Name</Label>
                        <Input
                          id="newFullName"
                          name="fullName"
                          value={accountForm.fullName}
                          onChange={(event) =>
                            setAccountForm((prev) => ({
                              ...prev,
                              fullName: event.target.value,
                            }))
                          }
                          placeholder="Enter your full name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newEmail">New Email</Label>
                        <Input
                          id="newEmail"
                          type="email"
                          name="email"
                          value={accountForm.email}
                          onChange={(event) =>
                            setAccountForm((prev) => ({
                              ...prev,
                              email: event.target.value,
                            }))
                          }
                          placeholder="Enter your email"
                          disabled
                        />
                        <p className="text-xs text-muted-foreground">
                          Email changes are temporarily disabled. Re-enable your
                          mail service to update this field.
                        </p>
                      </div>

                      <Button
                        type="submit"
                        className="w-full md:w-auto"
                        disabled={savingAccount}
                      >
                        {savingAccount ? "Saving..." : "Save Account Changes"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Update Password</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Choose a strong password, confirm it, then re-enter your
                      current password to finish.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-4" onSubmit={handlePasswordSubmit}>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          name="newPassword"
                          value={passwordForm.newPassword}
                          onChange={(event) =>
                            setPasswordForm((prev) => ({
                              ...prev,
                              newPassword: event.target.value,
                            }))
                          }
                          placeholder="Enter a new password"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          name="confirmPassword"
                          value={passwordForm.confirmPassword}
                          onChange={(event) =>
                            setPasswordForm((prev) => ({
                              ...prev,
                              confirmPassword: event.target.value,
                            }))
                          }
                          placeholder="Re-enter your new password"
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full md:w-auto"
                        disabled={savingPassword}
                      >
                        {savingPassword ? "Updating..." : "Save Password"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={handleConfirmDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirmationPassword">Current Password</Label>
            <Input
              id="confirmationPassword"
              type="password"
              value={confirmationPassword}
              onChange={(event) => setConfirmationPassword(event.target.value)}
              placeholder="Enter your current password"
              autoComplete="current-password"
              disabled={confirming}
            />
            {confirmationError ? (
              <p className="text-sm text-destructive">{confirmationError}</p>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={confirming || savingAccount || savingPassword}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              onClick={executePendingAction}
              disabled={
                confirming ||
                (pendingAction?.type === "account" && savingAccount) ||
                (pendingAction?.type === "password" && savingPassword)
              }
            >
              {confirming
                ? "Authorizing..."
                : pendingAction?.type === "account"
                ? "Apply Changes"
                : pendingAction?.type === "password"
                ? "Update Password"
                : "Continue"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Branch Dialog */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBranch ? "Edit Branch" : "Add New Branch"}
            </DialogTitle>
            <DialogDescription>
              {editingBranch
                ? "Update the branch details below."
                : "Enter the details for the new branch."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="branchName">Branch Name</Label>
              <Input
                id="branchName"
                value={branchForm.name}
                onChange={(e) =>
                  setBranchForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Davao Main Branch"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchAddress">Address (Optional)</Label>
              <Input
                id="branchAddress"
                value={branchForm.address}
                onChange={(e) =>
                  setBranchForm((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="e.g., 123 Main St, Davao City"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBranchDialogOpen(false)}
              disabled={savingBranch}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveBranch} disabled={savingBranch}>
              {savingBranch ? "Saving..." : editingBranch ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Add New User"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update the user details below."
                : "Create a new user account for your organization."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userName">Full Name</Label>
              <Input
                id="userName"
                value={userForm.fullName}
                onChange={(e) =>
                  setUserForm((prev) => ({ ...prev, fullName: e.target.value }))
                }
                placeholder="e.g., Maria Santos"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userEmail">Email</Label>
              <Input
                id="userEmail"
                type="email"
                value={userForm.email}
                onChange={(e) =>
                  setUserForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="e.g., maria@example.com"
                disabled={!!editingUser}
              />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="userPassword">Temporary Password</Label>
                <Input
                  id="userPassword"
                  type="password"
                  value={userForm.password}
                  onChange={(e) =>
                    setUserForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder="Min 6 characters"
                />
                <p className="text-xs text-muted-foreground">
                  Share this with the user. They can change it later.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="userBranch">Assign to Branch</Label>
              <Select
                value={userForm.branchId}
                onValueChange={(value) =>
                  setUserForm((prev) => ({ ...prev, branchId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
               <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUserDialogOpen(false)}
              disabled={savingUser}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={savingUser}>
              {savingUser ? "Saving..." : editingUser ? "Update" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}