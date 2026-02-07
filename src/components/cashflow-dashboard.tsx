import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCashflowStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Edit } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type Branch = {
  id: number;
  name: string;
};

export function CashflowDashboard() {
  const { cashflows, deleteCashflow, fetchCashflows, isLoading, error, userRole } =
    useCashflowStore();
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);

  const isAdmin = userRole === 'admin';

  const INCOME_COLOR = "#16a34a";
  const EXPENSE_COLOR = "#dc2626";

  const totalIncome = useMemo(
    () =>
      cashflows
        .filter((cf) => cf.category === "income")
        .reduce((sum, cf) => sum + cf.amount, 0),
    [cashflows],
  );

  const totalExpense = useMemo(
    () =>
      cashflows
        .filter((cf) => cf.category === "expense")
        .reduce((sum, cf) => sum + cf.amount, 0),
    [cashflows],
  );

  const balance = totalIncome - totalExpense;

  const incomeExpenseData = useMemo(
    () => [
      { name: "Income", value: totalIncome, fill: INCOME_COLOR },
      { name: "Expense", value: totalExpense, fill: EXPENSE_COLOR },
    ],
    [totalIncome, totalExpense],
  );

  const categoryBreakdown = useMemo(
    () =>
      cashflows.reduce(
        (acc, cf) => {
          const existing = acc.find((item) => item.name === cf.category);
          if (existing) {
            existing.value += cf.amount;
          } else {
            acc.push({ name: cf.category, value: cf.amount });
          }
          return acc;
        },
        [] as Array<{ name: string; value: number }>,
      ),
    [cashflows],
  );

  // Get branch name from ID
  const getBranchName = (branchId: number | null) => {
    if (!branchId) return "Unknown";
    const branch = branches.find((b) => b.id === branchId);
    return branch?.name || `Branch ${branchId}`;
  };

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        await fetchCashflows();
        
        // If admin, fetch branch names
        if (active) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('org_id, role')
              .eq('id', user.id)
              .single();
            
            if (profile?.role === 'admin' && profile?.org_id) {
              const { data: branchData } = await supabase
                .from('branches')
                .select('id, name')
                .eq('org_id', profile.org_id);
              
              if (branchData && active) {
                setBranches(branchData);
              }
            }
          }
        }
      } catch (fetchError) {
        if (!active) return;
        const description =
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load cashflows.";
        toast.error("Error", { description });
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [fetchCashflows]);

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await deleteCashflow(id);
      toast.success("Deleted", {
        description: "Cashflow entry has been deleted successfully.",
      });
      setDeletingId(null);
    } catch (deleteError) {
      const description =
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete cashflow.";
      toast.error("Error", { description });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
          {isAdmin && (
            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 rounded">
              Admin View
            </span>
          )}
        </div>
        <p className="text-muted-foreground">
          {isAdmin ? "Overview of all organization cashflows" : "Overview of your cashflows"}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(totalIncome)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Expense
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {formatCurrency(totalExpense)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatCurrency(balance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {cashflows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 mb-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Income vs Expense</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  value: {
                    label: "Amount",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-auto"
              >
                <div className="w-full" style={{ minHeight: 320 }}>
                  <ResponsiveContainer width="100%" aspect={2}>
                    <ReBarChart data={incomeExpenseData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {incomeExpenseData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  value: {
                    label: "Amount",
                  },
                }}
                className="h-auto"
              >
                <div className="w-full" style={{ minHeight: 320 }}>
                  <ResponsiveContainer width="100%" aspect={1}>
                    <RePieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie
                        data={categoryBreakdown}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, value }) =>
                          `${name}: ₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        }
                      >
                        {categoryBreakdown.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.name === "income" ? INCOME_COLOR : EXPENSE_COLOR
                            }
                          />
                        ))}
                      </Pie>
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cashflow Entries</CardTitle>
            <Button onClick={() => navigate("/create")}>Add New Entry</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && cashflows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading your cashflows...
            </div>
          ) : cashflows.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No cashflow entries yet
              </p>
              <Button onClick={() => navigate("/create")}>
                Create Your First Entry
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">
                      Name
                    </th>
                    {isAdmin && (
                      <th className="text-left py-3 px-4 font-semibold text-foreground">
                        Branch
                      </th>
                    )}
                    <th className="text-left py-3 px-4 font-semibold text-foreground">
                      Category
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">
                      Description
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cashflows.map((cashflow) => (
                    <tr
                      key={cashflow.id}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 px-4 text-foreground">
                        {cashflow.name}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                            {getBranchName(cashflow.branchId)}
                          </span>
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-sm font-medium ${
                            cashflow.category === "income"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                          }`}
                        >
                          {cashflow.category.charAt(0).toUpperCase() +
                            cashflow.category.slice(1)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-foreground font-semibold">
                        {formatCurrency(cashflow.amount)}
                      </td>
                      <td className="py-3 px-4 text-foreground">
                        {formatDate(cashflow.date)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">
                        {cashflow.description?.trim()
                          ? cashflow.description
                          : "No description"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate("/update", {
                                state: { cashflowId: cashflow.id },
                              })
                            }
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog
                            open={deletingId === cashflow.id}
                            onOpenChange={(open) => {
                              if (!open) setDeletingId(null);
                            }}
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeletingId(cashflow.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogTitle>
                                Delete Cashflow
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this cashflow
                                entry? This action cannot be undone.
                              </AlertDialogDescription>
                              <div className="flex justify-end gap-2">
                                <AlertDialogCancel onClick={() => setDeletingId(null)}>
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(cashflow.id)}
                                  disabled={isDeleting}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {isDeleting ? "Deleting..." : "Delete"}
                                </AlertDialogAction>
                              </div>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}