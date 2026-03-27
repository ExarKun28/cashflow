import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCashflowStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Edit, CalendarDays, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const ITEMS_PER_PAGE = 10;

// Helper: detect if a cashflow entry is a refund by its name prefix
const isRefundEntry = (name: string) => name.startsWith("[REFUND]");

export function CashflowDashboard() {
  const { cashflows, deleteCashflow, fetchCashflows, isLoading, error, userRole } =
    useCashflowStore();
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoaded, setBranchesLoaded] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const isAdmin = userRole === "admin";

  const INCOME_COLOR = "#16a34a";
  const EXPENSE_COLOR = "#dc2626";
  const REFUND_COLOR = "#f97316"; // orange-500

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    cashflows.forEach((cf) => {
      const date = new Date(cf.date);
      if (!isNaN(date.getTime())) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        months.add(monthKey);
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [cashflows]);

  const formatMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const filteredCashflows = useMemo(() => {
    let filtered = cashflows;

    if (selectedMonth !== "all") {
      filtered = filtered.filter((cf) => {
        const date = new Date(cf.date);
        if (isNaN(date.getTime())) return false;
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        return monthKey === selectedMonth;
      });
    }

    if (isAdmin && selectedBranch !== "all") {
      filtered = filtered.filter((cf) => cf.branchId === parseInt(selectedBranch));
    }

    return filtered;
  }, [cashflows, selectedMonth, selectedBranch, isAdmin]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, selectedBranch]);

  const totalPages = Math.ceil(filteredCashflows.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCashflows = filteredCashflows.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    return pages;
  };

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalIncome = useMemo(
    () =>
      filteredCashflows
        .filter((cf) => cf.category === "income" && !isRefundEntry(cf.name))
        .reduce((sum, cf) => sum + cf.amount, 0),
    [filteredCashflows],
  );

  const totalExpense = useMemo(
    () =>
      filteredCashflows
        .filter((cf) => cf.category === "expense" && !isRefundEntry(cf.name))
        .reduce((sum, cf) => sum + cf.amount, 0),
    [filteredCashflows],
  );

  // Refunds are entries whose name starts with [REFUND]
  const totalRefunds = useMemo(
    () =>
      filteredCashflows
        .filter((cf) => isRefundEntry(cf.name))
        .reduce((sum, cf) => sum + cf.amount, 0),
    [filteredCashflows],
  );

  const balance = totalIncome - totalExpense - totalRefunds;

  // ── Chart data ──────────────────────────────────────────────────────────────
  const incomeExpenseData = useMemo(() => {
    const data = [
      { name: "Income", value: totalIncome, fill: INCOME_COLOR },
      { name: "Expense", value: totalExpense, fill: EXPENSE_COLOR },
    ];
    if (totalRefunds > 0) {
      data.push({ name: "Refund", value: totalRefunds, fill: REFUND_COLOR });
    }
    return data;
  }, [totalIncome, totalExpense, totalRefunds]);

  const categoryBreakdown = useMemo(() => {
    const acc: Array<{ name: string; value: number }> = [];

    filteredCashflows.forEach((cf) => {
      // Use "refund" as its own category in the pie chart
      const label = isRefundEntry(cf.name) ? "refund" : cf.category;
      const existing = acc.find((item) => item.name === label);
      if (existing) {
        existing.value += cf.amount;
      } else {
        acc.push({ name: label, value: cf.amount });
      }
    });

    return acc;
  }, [filteredCashflows]);

  const getCategoryColor = (name: string) => {
    if (name === "income") return INCOME_COLOR;
    if (name === "expense") return EXPENSE_COLOR;
    if (name === "refund") return REFUND_COLOR;
    return "#888";
  };

  const getBranchName = (branchId: number | null) => {
    if (!branchId) return "Unknown";
    const branch = branches.find((b) => b.id === branchId);
    return branch?.name || `Branch ${branchId}`;
  };

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user && active) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("org_id, role")
            .eq("id", user.id)
            .single();

          if (profile?.role === "admin" && profile?.org_id) {
            const { data: branchData } = await supabase
              .from("branches")
              .select("id, name")
              .eq("org_id", profile.org_id);

            if (branchData && active) setBranches(branchData);
          }
        }

        if (active) setBranchesLoaded(true);
        if (active) await fetchCashflows();
      } catch (fetchError) {
        if (!active) return;
        setBranchesLoaded(true);
        const description =
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load cashflows.";
        toast.error("Error", { description });
      }
    };

    loadData();
    return () => { active = false; };
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
        deleteError instanceof Error ? deleteError.message : "Unable to delete cashflow.";
      toast.error("Error", { description });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) =>
    `₱${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // ── Category badge helper ───────────────────────────────────────────────────
  const CategoryBadge = ({ cashflow }: { cashflow: (typeof filteredCashflows)[0] }) => {
    if (isRefundEntry(cashflow.name)) {
      return (
        <span className="px-2 py-1 rounded text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100">
          Refund
        </span>
      );
    }
    return (
      <span
        className={`px-2 py-1 rounded text-sm font-medium ${
          cashflow.category === "income"
            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
        }`}
      >
        {cashflow.category.charAt(0).toUpperCase() + cashflow.category.slice(1)}
      </span>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
            {isAdmin && (
              <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 rounded">
                Admin View
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && branchesLoaded && branches.length > 0 && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  {monthOptions.map((monthKey) => (
                    <SelectItem key={monthKey} value={monthKey}>
                      {formatMonthLabel(monthKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground">
          {isAdmin ? "Overview of all organization cashflows" : "Overview of your cashflows"}
          {(selectedMonth !== "all" || selectedBranch !== "all") && (
            <span className="ml-2 text-primary font-medium">
              • Filtered:
              {selectedBranch !== "all" && ` ${getBranchName(parseInt(selectedBranch))}`}
              {selectedMonth !== "all" && ` ${formatMonthLabel(selectedMonth)}`}
            </span>
          )}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Summary cards (4 when refunds exist, 3 otherwise) ── */}
      <div className={`grid grid-cols-1 gap-4 mb-8 ${totalRefunds > 0 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{formatCurrency(totalExpense)}</div>
          </CardContent>
        </Card>

        {/* Refund card — only shown when refunds exist */}
        {totalRefunds > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Refunds</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">{formatCurrency(totalRefunds)}</div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(balance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {filteredCashflows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 mb-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Income vs Expense</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{ value: { label: "Amount", color: "hsl(var(--primary))" } }}
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
                config={{ value: { label: "Amount" } }}
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
                          `${name}: ₱${value.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        }
                      >
                        {categoryBreakdown.map((entry) => (
                          <Cell key={entry.name} fill={getCategoryColor(entry.name)} />
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
            <CardTitle>
              Cashflow Entries
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredCashflows.length} total entries)
              </span>
            </CardTitle>
            <Button onClick={() => navigate("/create")}>Add New Entry</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && cashflows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Loading your cashflows...</div>
          ) : filteredCashflows.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                {selectedMonth === "all" && selectedBranch === "all"
                  ? "No cashflow entries yet"
                  : "No entries for the selected filters"}
              </p>
              {selectedMonth === "all" && selectedBranch === "all" ? (
                <Button onClick={() => navigate("/create")}>Create Your First Entry</Button>
              ) : (
                <Button variant="outline" onClick={() => { setSelectedMonth("all"); setSelectedBranch("all"); }}>
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Name</th>
                      {isAdmin && (
                        <th className="text-left py-3 px-4 font-semibold text-foreground">Branch</th>
                      )}
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Category</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Amount</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Description</th>
                      <th className="text-right py-3 px-4 font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCashflows.map((cashflow) => (
                      <tr
                        key={cashflow.id}
                        className={`border-b border-border transition-colors ${
                          isRefundEntry(cashflow.name)
                            ? "bg-orange-50/40 dark:bg-orange-950/20 hover:bg-orange-50/70 dark:hover:bg-orange-950/30"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <td className="py-3 px-4 text-foreground">{cashflow.name}</td>
                        {isAdmin && (
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 rounded text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                              {getBranchName(cashflow.branchId)}
                            </span>
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <CategoryBadge cashflow={cashflow} />
                        </td>
                        <td className={`py-3 px-4 font-semibold ${isRefundEntry(cashflow.name) ? "text-orange-500" : "text-foreground"}`}>
                          {formatCurrency(cashflow.amount)}
                        </td>
                        <td className="py-3 px-4 text-foreground">{formatDate(cashflow.date)}</td>
                        <td className="py-3 px-4 text-muted-foreground text-sm">
                          {cashflow.description?.trim() ? cashflow.description : "No description"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate("/update", { state: { cashflowId: cashflow.id } })}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog
                              open={deletingId === cashflow.id}
                              onOpenChange={(open) => { if (!open) setDeletingId(null); }}
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
                                <AlertDialogTitle>Delete Cashflow</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this cashflow entry? This action cannot be undone.
                                </AlertDialogDescription>
                                <div className="flex justify-end gap-2">
                                  <AlertDialogCancel onClick={() => setDeletingId(null)}>Cancel</AlertDialogCancel>
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

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredCashflows.length)} of {filteredCashflows.length} entries
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {getPageNumbers().map((page, index) =>
                      page === "..." ? (
                        <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">...</span>
                      ) : (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page as number)}
                          className="min-w-[36px]"
                        >
                          {page}
                        </Button>
                      )
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}