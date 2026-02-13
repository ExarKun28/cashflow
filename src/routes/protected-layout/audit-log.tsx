import { useEffect, useState, useMemo } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getBlockchainTransactions, checkBlockchainHealth, type BlockchainTransaction } from '@/lib/blockchain'
import { Shield, CheckCircle, XCircle, RefreshCw, Building2, User, CalendarDays } from 'lucide-react'
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

export default function AuditLogPage() {
  const [transactions, setTransactions] = useState<BlockchainTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isHealthy, setIsHealthy] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  
  // Month filter state
  const [selectedMonth, setSelectedMonth] = useState<string>("all")

  const isAdmin = userRole === 'admin'

  // Generate month options from available transactions
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

  // Format month key to readable label
  const formatMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  // Filter transactions by selected month
  const filteredTransactions = useMemo(() => {
    if (selectedMonth === "all") {
      return transactions
    }

    return transactions.filter((tx) => {
      const date = new Date(tx.date)
      if (isNaN(date.getTime())) return false
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      return monthKey === selectedMonth
    })
  }, [transactions, selectedMonth])

  // Calculate totals based on filtered data
  const totalIncome = useMemo(() => 
    filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  )

  const totalExpense = useMemo(() => 
    filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  )

  // Get branch name from smeName (format: "orgId-branchId")
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
      const orgId = profile?.org_id
      setUserRole(role)

      if (role === 'admin' && orgId) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', orgId)
          .single()
        setOrgName(org?.name || null)

        const { data: branchData } = await supabase
          .from('branches')
          .select('id, name')
          .eq('org_id', orgId)
        
        if (branchData) {
          setBranches(branchData)
        }
      }

      const health = await checkBlockchainHealth()
      setIsHealthy(health.status === 'OK')

      const allTransactions = await getBlockchainTransactions()
      
      let filteredTx: BlockchainTransaction[] = []

      if (role === 'admin' && orgId) {
        const { data: orgBranches } = await supabase
          .from('branches')
          .select('id')
          .eq('org_id', orgId)

        const branchIds = orgBranches?.map(b => b.id) || []
        
        const { data: orgUsers } = await supabase
          .from('profiles')
          .select('id')
          .eq('org_id', orgId)

        const orgUserIds = orgUsers?.map(u => u.id) || []
        
        filteredTx = allTransactions.filter(tx => 
          branchIds.some(branchId => tx.smeName === `${orgId}-${branchId}`) ||
          tx.smeName === orgId ||
          orgUserIds.includes(tx.smeName)
        )
        
        console.log('[AuditLog] Admin mode: showing all org transactions', {
          orgId,
          branchCount: branchIds.length,
          userCount: orgUserIds.length,
          transactionCount: filteredTx.length
        })
      } else {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('branch_id')
          .eq('id', user.id)
          .single()

        const userBranchId = userProfile?.branch_id

        filteredTx = allTransactions.filter(tx => 
          tx.smeName === `${orgId}-${userBranchId}` ||
          tx.smeName === user.id
        )

        console.log('[AuditLog] User mode: showing branch transactions only', {
          userId: user.id,
          orgId: orgId,
          branchId: userBranchId,
          transactionCount: filteredTx.length
        })
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
              {/* Month Filter */}
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

          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <CardTitle className="text-sm font-medium">
                  Total Transactions
                  {selectedMonth !== "all" && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {formatMonthLabel(selectedMonth)}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredTransactions.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Income
                  {selectedMonth !== "all" && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {formatMonthLabel(selectedMonth)}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  {formatCurrency(totalIncome)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Expense
                  {selectedMonth !== "all" && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {formatMonthLabel(selectedMonth)}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {formatCurrency(totalExpense)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Last Updated */}
          {lastUpdated && (
            <p className="text-sm text-muted-foreground">
              Last updated: {formatTimestamp(lastUpdated.toISOString())}
              {selectedMonth !== "all" && (
                <span className="ml-2 text-primary">
                  • Filtered: {formatMonthLabel(selectedMonth)}
                </span>
              )}
            </p>
          )}

          {/* Transactions List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Blockchain Transactions
                {selectedMonth !== "all" ? (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({filteredTransactions.length} entries in {formatMonthLabel(selectedMonth)})
                  </span>
                ) : userRole === 'admin' && (
                  <span className="text-sm font-normal text-muted-foreground">
                    (All organization transactions)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading blockchain data...</div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {selectedMonth === "all" 
                    ? "No transactions recorded on blockchain yet."
                    : `No transactions for ${formatMonthLabel(selectedMonth)}.`}
                  {selectedMonth !== "all" && (
                    <div className="mt-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedMonth("all")}>
                        Show All Transactions
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Transaction ID</th>
                        {isAdmin && (
                          <th className="text-left py-3 px-2">Branch</th>
                        )}
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
                      {filteredTransactions.map((tx) => (
                        <tr key={tx.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2 font-mono text-xs">{tx.id}</td>
                          {isAdmin && (
                            <td className="py-3 px-2">
                              <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-500">
                                {getBranchName(tx.smeName)}
                              </span>
                            </td>
                          )}
                          <td className="py-3 px-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              tx.type === 'income' 
                                ? 'bg-green-500/20 text-green-500' 
                                : 'bg-red-500/20 text-red-500'
                            }`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="py-3 px-2">{tx.category}</td>
                          <td className={`py-3 px-2 font-medium ${
                            tx.type === 'income' ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="py-3 px-2 text-xs max-w-[200px] truncate" title={tx.description}>
                            {tx.description ? (
                              <span className={tx.description.startsWith('[AMENDMENT]') ? 'text-yellow-500' : tx.description.startsWith('[DELETED]') ? 'text-red-500' : ''}>
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
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}