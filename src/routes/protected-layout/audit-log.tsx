import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getBlockchainTransactions, checkBlockchainHealth, type BlockchainTransaction } from '@/lib/blockchain'
import { Shield, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AuditLogPage() {
  const [transactions, setTransactions] = useState<BlockchainTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isHealthy, setIsHealthy] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const health = await checkBlockchainHealth()
      setIsHealthy(health.status === 'OK')

      const data = await getBlockchainTransactions()
      setTransactions(data)
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

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

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
            </div>
            <Button onClick={fetchData} disabled={isLoading} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
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
                <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{transactions.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  {formatCurrency(totalIncome)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Expense</CardTitle>
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
            </p>
          )}

          {/* Transactions List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Blockchain Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading blockchain data...</div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions recorded on blockchain yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Transaction ID</th>
                        <th className="text-left py-3 px-2">Type</th>
                        <th className="text-left py-3 px-2">Category</th>
                        <th className="text-left py-3 px-2">Amount</th>
                        <th className="text-left py-3 px-2">Date</th>
                        <th className="text-left py-3 px-2">Timestamp</th>
                        <th className="text-left py-3 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2 font-mono text-xs">{tx.id}</td>
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