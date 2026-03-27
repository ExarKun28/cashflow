import { useEffect, useState, useMemo } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getBlockchainTransactions, checkBlockchainHealth, type BlockchainTransaction } from '@/lib/blockchain'
import { Shield, CheckCircle, XCircle, RefreshCw, Building2, User, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Branch = {
  id: number;
  name: string;
};

const ITEMS_PER_PAGE = 10;

// Helper: detect refund entries by category prefix
const isRefundCategory = (category: string) => category.startsWith('[REFUND]')

export default function AuditLogPage() {
  const [transactions, setTransactions] = useState<BlockchainTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isHealthy, setIsHealthy] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])

  const [selectedMonth, setSelectedMonth] = useState<string>("all")
  const [selectedBranch, setSelectedBranch] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)

  const isAdmin = userRole === 'admin'

  const monthOptions = useMemo(() => {
    const months = new Set<string>()
    transactions.forEach((tx) => {
      const date = new Date(tx.date)
      if (!isNaN(date.getTime())) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        months.add(monthKey)
      }
    })
    return Array.from(months).sort((a, b) => b.localeCompare(a))
  }, [transactions])

  const formatMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const getBranchIdFromSmeName = (smeName: string): number | null => {
    if (!smeName) return null
    const parts = smeName.split('-')
    if (parts.length >= 2) {
      const branchId = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(branchId)) return branchId
    }
    return null
  }

  const filteredTransactions = useMemo(() => {
    let filtered = transactions

    if (selectedMonth !== "all") {
      filtered = filtered.filter((tx) => {
        const date = new Date(tx.date)
        if (isNaN(date.getTime())) return false
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        return monthKey === selectedMonth
      })
    }

    if (isAdmin && selectedBranch !== "all") {
      filtered = filtered.filter((tx) => {
        const branchId = getBranchIdFromSmeName(tx.smeName)
        return branchId === parseInt(selectedBranch)
      })
    }

    return filtered
  }, [transactions, selectedMonth, selectedBranch, isAdmin])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedMonth, selectedBranch])

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex)

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      }
    }
    return pages
  }

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalIncome = useMemo(() =>
    filteredTransactions
      .filter(t => t.type === 'income' && !isRefundCategory(t.category))
      .reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  )

  const totalExpense = useMemo(() =>
    filteredTransactions
      .filter(t => t.type === 'expense' && !isRefundCategory(t.category))
      .reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  )

  // Refunds: entries whose category starts with [REFUND]
  const totalRefunds = useMemo(() =>
    filteredTransactions
      .filter(t => isRefundCategory(t.category))
      .reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  )

  const balance = totalIncome - totalExpense - totalRefunds

  const getBranchName = (smeName: string) => {
    if (!smeName) return "Unknown"
    const parts = smeName.split('-')
    if (parts.length >= 2) {
      const branchId = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(branchId)) {
        const branch = branches.find((b) => b.id === branchId)
        return branch?.name || `Branch ${branchId}`
      }
    }
    return "Unknown"
  }

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setIsLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, org_id')
        .eq('id', user.id)
        .single()

      const role = profile?.role || 'user'
      const userOrgId = profile?.org_id
      setUserRole(role)

      if (role === 'admin' && userOrgId) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', userOrgId)
          .single()
        setOrgName(org?.name || null)

        const { data: branchData } = await supabase
          .from('branches')
          .select('id, name')
          .eq('org_id', userOrgId)

        if (branchData) setBranches(branchData)
      }

      const health = await checkBlockchainHealth()
      setIsHealthy(health.status === 'OK')

      const allTransactions = await getBlockchainTransactions()

      let filteredTx: BlockchainTransaction[] = []

      if (role === 'admin' && userOrgId) {
        const { data: orgBranches } = await supabase
          .from('branches')
          .select('id')
          .eq('org_id', userOrgId)

        const branchIds = orgBranches?.map(b => b.id) || []

        const { data: orgUsers } = await supabase
          .from('profiles')
          .select('id')
          .eq('org_id', userOrgId)

        const orgUserIds = orgUsers?.map(u => u.id) || []

        filteredTx = allTransactions.filter(tx =>
          branchIds.some(branchId => tx.smeName === `${userOrgId}-${branchId}`) ||
          tx.smeName === userOrgId ||
          orgUserIds.includes(tx.smeName)
        )
      } else {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('branch_id')
          .eq('id', user.id)
          .single()

        const userBranchId = userProfile?.branch_id

        filteredTx = allTransactions.filter(tx =>
          tx.smeName === `${userOrgId}-${userBranchId}` ||
          tx.smeName === user.id
        )
      }

      setTransactions(filteredTx)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch blockchain data:', error)
      setIsHealthy(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  // ── Description color helper ─────────────────────────────────────────────
  const getDescriptionClass = (description: string) => {
    if (description.startsWith('[AMENDMENT]')) return 'text-yellow-500'
    if (description.startsWith('[DELETED]'))   return 'text-red-500'
    if (description.startsWith('[REFUND]'))    return 'text-orange-500'
    return ''
  }

  // ── Type badge helper ────────────────────────────────────────────────────
  const TypeBadge = ({ tx }: { tx: BlockchainTransaction }) => {
    if (isRefundCategory(tx.category)) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-orange-500/20 text-orange-500">
          refund
        </span>
      )
    }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${
        tx.type === 'income'
          ? 'bg-green-500/20 text-green-500'
          : 'bg-red-500/20 text-red-500'
      }`}>
        {tx.type}
      </span>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Blockchain Audit Log</h1>
              <p className="text-muted-foreground">
                Immutable transaction records on Hyperledger Fabric
              </p>
              {userRole && (
                <div className="flex items-center gap-2 mt-2">
                  {userRole === 'admin' ? (
                    <span className="inline-flex items-center gap-1 text-sm bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">
                      <Building2 className="h-3 w-3" />
                      Admin View - Showing all {orgName || 'organization'} transactions
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm bg-blue-500/20 text-blue-500 px-2 py-1 rounded">
                      <User className="h-3 w-3" />
                      User View - Showing your transactions only
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isAdmin && branches.length > 0 && (
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

              <Button onClick={fetchData} disabled={isLoading} variant="outline">
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* ── Status Cards — 6 when refunds exist, 5 otherwise ── */}
          <div className={`grid grid-cols-1 gap-4 ${totalRefunds > 0 ? 'md:grid-cols-6' : 'md:grid-cols-5'}`}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Blockchain Status</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {isHealthy ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-green-500 font-semibold">Connected</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-500" />
                      <span className="text-red-500 font-semibold">Disconnected</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredTransactions.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{formatCurrency(totalIncome)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Expense</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{formatCurrency(totalExpense)}</div>
              </CardContent>
            </Card>

            {/* Refund card — only shown when refunds exist */}
            {totalRefunds > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Refunds</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-500">{formatCurrency(totalRefunds)}</div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(balance)}
                </div>
              </CardContent>
            </Card>
          </div>

          {lastUpdated && (
            <p className="text-sm text-muted-foreground">
              Last updated: {formatTimestamp(lastUpdated.toISOString())}
              {(selectedMonth !== "all" || selectedBranch !== "all") && (
                <span className="ml-2 text-primary">
                  • Filtered:
                  {selectedBranch !== "all" && ` ${branches.find(b => b.id === parseInt(selectedBranch))?.name || 'Branch'}`}
                  {selectedMonth !== "all" && ` ${formatMonthLabel(selectedMonth)}`}
                </span>
              )}
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Blockchain Transactions
                <span className="text-sm font-normal text-muted-foreground">
                  ({filteredTransactions.length} total entries)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading blockchain data...</div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {selectedMonth === "all" && selectedBranch === "all"
                    ? "No transactions recorded on blockchain yet."
                    : "No transactions for the selected filters."}
                  {(selectedMonth !== "all" || selectedBranch !== "all") && (
                    <div className="mt-2">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedMonth("all"); setSelectedBranch("all") }}>
                        Clear Filters
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">Transaction ID</th>
                          {isAdmin && <th className="text-left py-3 px-2">Branch</th>}
                          <th className="text-left py-3 px-2">Type</th>
                          <th className="text-left py-3 px-2">Category</th>
                          <th className="text-left py-3 px-2">Amount</th>
                          <th className="text-left py-3 px-2">Description</th>
                          <th className="text-left py-3 px-2">Date</th>
                          <th className="text-left py-3 px-2">Timestamp</th>
                          <th className="text-left py-3 px-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTransactions.map((tx) => {
                          const isRefund = isRefundCategory(tx.category)
                          return (
                            <tr
                              key={tx.id}
                              className={`border-b transition-colors ${
                                isRefund
                                  ? 'bg-orange-50/30 dark:bg-orange-950/20 hover:bg-orange-50/60 dark:hover:bg-orange-950/30'
                                  : 'hover:bg-muted/50'
                              }`}
                            >
                              <td className="py-3 px-2 font-mono text-xs">{tx.id}</td>
                              {isAdmin && (
                                <td className="py-3 px-2">
                                  <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-500">
                                    {getBranchName(tx.smeName)}
                                  </span>
                                </td>
                              )}
                              <td className="py-3 px-2">
                                <TypeBadge tx={tx} />
                              </td>
                              <td className={`py-3 px-2 ${isRefund ? 'text-orange-500 font-medium' : ''}`}>
                                {tx.category}
                              </td>
                              <td className={`py-3 px-2 font-medium ${
                                isRefund
                                  ? 'text-orange-500'
                                  : tx.type === 'income' ? 'text-green-500' : 'text-red-500'
                              }`}>
                                {formatCurrency(tx.amount)}
                              </td>
                              <td className="py-3 px-2 text-xs max-w-[200px] truncate" title={tx.description}>
                                {tx.description ? (
                                  <span className={getDescriptionClass(tx.description)}>
                                    {tx.description}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="py-3 px-2">{formatDate(tx.date)}</td>
                              <td className="py-3 px-2 text-xs">{formatTimestamp(tx.createdAt)}</td>
                              <td className="py-3 px-2">
                                <span className="flex items-center gap-1 text-green-500 text-xs">
                                  <CheckCircle className="h-3 w-3" />
                                  Verified
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Showing {startIndex + 1} to {Math.min(endIndex, filteredTransactions.length)} of {filteredTransactions.length} entries
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>

                        {getPageNumbers().map((page, index) => (
                          page === '...' ? (
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
                        ))}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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
      </main>
    </div>
  )
}