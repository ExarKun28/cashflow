import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from '@/components/sidebar'
import { CashflowUpdateForm } from '@/components/cashflow-update-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useCashflowStore } from '@/lib/store'
import { toast } from 'sonner'

const ITEMS_PER_PAGE = 10

export default function UpdatePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [manualSelection, setManualSelection] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const cashflows = useCashflowStore((state) => state.cashflows)
  const fetchCashflows = useCashflowStore((state) => state.fetchCashflows)
  const isLoading = useCashflowStore((state) => state.isLoading)
  const routeState = location.state as { cashflowId?: string } | null
  const routeCashflowId = routeState?.cashflowId ?? null

  useEffect(() => {
    let active = true

    fetchCashflows().catch((error) => {
      if (!active) return
      const description =
        error instanceof Error
          ? error.message
          : 'Unable to load your cashflows.'
      toast.error('Error', { description })
    })

    return () => {
      active = false
    }
  }, [fetchCashflows])

  // Filter cashflows by search query (name or date)
  const filteredCashflows = useMemo(() => {
    if (!searchQuery.trim()) return cashflows
    const q = searchQuery.toLowerCase()
    return cashflows.filter((cf) => {
      const nameMatch = cf.name.toLowerCase().includes(q)
      const dateMatch = new Date(cf.date)
        .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        .toLowerCase()
        .includes(q)
      return nameMatch || dateMatch
    })
  }, [cashflows, searchQuery])

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  // Pagination
  const totalPages = Math.ceil(filteredCashflows.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedCashflows = filteredCashflows.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    if (totalPages <= 5) {
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

  const selectedId = useMemo(() => {
    const preferredId = manualSelection ?? routeCashflowId
    if (preferredId && cashflows.some((cf) => cf.id === preferredId)) {
      return preferredId
    }
    return cashflows[0]?.id ?? null
  }, [manualSelection, routeCashflowId, cashflows])

  const selectedCashflow = selectedId
    ? cashflows.find((cf) => cf.id === selectedId) ?? null
    : null

  const formatDate = (value: string) => {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto py-8 px-4">
          <Button
            variant="ghost"
            className="mb-6"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Update Cashflow</h1>
            <p className="text-muted-foreground mt-2">Edit an existing cashflow entry</p>
          </div>

          {isLoading && cashflows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Loading cashflows...
            </div>
          ) : cashflows.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No cashflows to update</p>
              <Button onClick={() => navigate('/create')}>
                Create First Cashflow
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Left panel — list */}
              <div className="lg:col-span-1">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-foreground">Select Cashflow</h2>
                  <span className="text-xs text-muted-foreground">
                    {filteredCashflows.length} entries
                  </span>
                </div>

                {/* Search bar */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or date..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>

                {/* Cashflow list */}
                <div className="space-y-2">
                  {paginatedCashflows.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No results found
                    </p>
                  ) : (
                    paginatedCashflows.map((cf) => (
                      <button
                        key={cf.id}
                        onClick={() => setManualSelection(cf.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedId === cf.id
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        <div className="font-medium text-sm truncate">{cf.name}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs opacity-75 capitalize">{cf.category}</span>
                          <span className="text-xs opacity-75">{formatDate(cf.date)}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <div className="text-xs text-muted-foreground mb-2 text-center">
                      {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredCashflows.length)} of {filteredCashflows.length}
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>

                      {getPageNumbers().map((page, index) =>
                        page === '...' ? (
                          <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">
                            ...
                          </span>
                        ) : (
                          <Button
                            key={page}
                            variant={currentPage === page ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 w-7 p-0 text-xs"
                            onClick={() => setCurrentPage(page as number)}
                          >
                            {page}
                          </Button>
                        )
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right panel — form */}
              <div className="lg:col-span-3">
                {selectedCashflow && (
                  <CashflowUpdateForm
                    key={selectedCashflow.id}
                    cashflow={selectedCashflow}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}