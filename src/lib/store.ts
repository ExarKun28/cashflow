import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { createBlockchainTransaction, deleteBlockchainTransaction, getBlockchainTransactions } from '@/lib/blockchain'

const INCOME_TABLE = 'income_transaction'
const EXPENSE_TABLE = 'expense_transaction'
const PROFILE_TABLE = 'profiles'

type SourceTable = typeof INCOME_TABLE | typeof EXPENSE_TABLE

type ProfileRow = {
  id: string
  branch_id: number | null
}

type IncomeRow = {
  id: number
  branch_id: number | null
  created_at: string | null
  amount: number | null
  income_type: string | null
  cashflow_id: number | null
}

type ExpenseRow = {
  id: number
  branch_id: number | null
  created_at: string | null
  amount: number | null
  expense_category: string | null
  description: string | null
  cashflow_id: number | null
}

export interface Cashflow {
  id: string
  sourceId: number
  sourceTable: SourceTable
  name: string
  category: 'income' | 'expense'
  amount: number
  date: string
  description: string | null
  branchId: number | null
  cashflowId: number | null
}

export type CashflowInput = {
  name: string
  category: 'income' | 'expense'
  amount: number
  date: string
  description?: string | null
}

interface CashflowStore {
  cashflows: Cashflow[]
  isLoading: boolean
  error: string | null
  fetchCashflows: () => Promise<void>
  addCashflow: (payload: CashflowInput) => Promise<Cashflow | null>
  updateCashflow: (
    id: string,
    payload: Partial<CashflowInput>
  ) => Promise<Cashflow | null>
  deleteCashflow: (id: string) => Promise<void>
}

const normalizeTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return new Date().toISOString()
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }

  return parsed.toISOString()
}

const normalizeDateInput = (value: string | undefined) => {
  if (!value) {
    return undefined
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  return parsed.toISOString()
}

const mapIncomeRow = (row: IncomeRow): Cashflow => ({
  id: `${INCOME_TABLE}-${row.id}`,
  sourceId: row.id,
  sourceTable: INCOME_TABLE,
  name: row.income_type ?? 'Income',
  category: 'income',
  amount: row.amount ?? 0,
  date: normalizeTimestamp(row.created_at),
  description: null,
  branchId: row.branch_id ?? null,
  cashflowId: row.cashflow_id ?? null,
})

const mapExpenseRow = (row: ExpenseRow): Cashflow => ({
  id: `${EXPENSE_TABLE}-${row.id}`,
  sourceId: row.id,
  sourceTable: EXPENSE_TABLE,
  name: row.expense_category ?? 'Expense',
  category: 'expense',
  amount: row.amount ?? 0,
  date: normalizeTimestamp(row.created_at),
  description: row.description ?? null,
  branchId: row.branch_id ?? null,
  cashflowId: row.cashflow_id ?? null,
})

const ensureProfile = async () => {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    throw new Error(authError.message)
  }

  if (!user) {
    throw new Error('You must be logged in to access cashflows')
  }

  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select('id, branch_id')
    .eq('id', user.id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const profile = (data ?? null) as ProfileRow | null

  if (!profile?.branch_id) {
    throw new Error('Your profile is missing a branch assignment')
  }

  return { userId: user.id, branchId: profile.branch_id }
}

const buildInsertPayload = (
  payload: CashflowInput,
  branchId: number,
): Record<string, unknown> => {
  const base = {
    branch_id: branchId,
    amount: payload.amount,
    created_at: normalizeDateInput(payload.date) ?? new Date().toISOString(),
    cashflow_id: null,
  }

  if (payload.category === 'income') {
    return {
      ...base,
      income_type: payload.name,
    }
  }

  return {
    ...base,
    expense_category: payload.name,
    description: payload.description ?? null,
  }
}

const buildUpdatePayload = (
  payload: Partial<CashflowInput>,
): Record<string, unknown> => {
  const updates: Record<string, unknown> = {}

  if (payload.amount !== undefined) {
    updates.amount = payload.amount
  }

  if (payload.date) {
    const timestamp = normalizeDateInput(payload.date)
    if (timestamp) {
      updates.created_at = timestamp
    }
  }

  if (payload.description !== undefined) {
    updates.description = payload.description ?? null
  }

  return updates
}

export const useCashflowStore = create<CashflowStore>((set, get) => ({
  cashflows: [],
  isLoading: false,
  error: null,
  fetchCashflows: async () => {
    set({ isLoading: true, error: null })
    console.log('[CashflowStore] fetchCashflows start')

    try {
      const { branchId } = await ensureProfile()

      const [incomeResult, expenseResult] = await Promise.all([
        supabase
          .from(INCOME_TABLE)
          .select('*')
          .eq('branch_id', branchId)
          .order('created_at', { ascending: false }),
        supabase
          .from(EXPENSE_TABLE)
          .select('*')
          .eq('branch_id', branchId)
          .order('created_at', { ascending: false }),
      ])

      if (incomeResult.error) {
        throw incomeResult.error
      }

      if (expenseResult.error) {
        throw expenseResult.error
      }

      const incomeEntries = (incomeResult.data ?? []).map(mapIncomeRow)
      const expenseEntries = (expenseResult.data ?? []).map(mapExpenseRow)

      const combined = [...incomeEntries, ...expenseEntries].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      )

      set({ cashflows: combined, isLoading: false, error: null })
      console.log('[CashflowStore] fetchCashflows success', {
        income: incomeEntries.length,
        expense: expenseEntries.length,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      set({ isLoading: false, error: message, cashflows: [] })
      console.error('[CashflowStore] fetchCashflows error', error)
      throw error
    }
  },
  addCashflow: async (payload) => {
    console.log('[CashflowStore] addCashflow start', payload)

    const { branchId } = await ensureProfile()

    const insertPayload = buildInsertPayload(payload, branchId)
    const table = payload.category === 'income' ? INCOME_TABLE : EXPENSE_TABLE

    const { data, error } = await supabase
      .from(table)
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      console.error('[CashflowStore] addCashflow error', error)
      throw new Error(error.message)
    }

    const inserted = (data ?? null) as IncomeRow | ExpenseRow | null

    if (!inserted) {
      return null
    }

    const normalized =
      table === INCOME_TABLE
        ? mapIncomeRow(inserted as IncomeRow)
        : mapExpenseRow(inserted as ExpenseRow)

    // Also save to blockchain for transparency
    try {
      await createBlockchainTransaction({
        smeId: String(branchId),
        type: payload.category,
        amount: payload.amount,
        category: payload.name,
        description: payload.description || '',
        date: payload.date,
      })
      console.log('[CashflowStore] Blockchain transaction recorded')
    } catch (blockchainError) {
      console.warn('[CashflowStore] Blockchain save failed (non-critical):', blockchainError)
      // Don't throw - Supabase save succeeded, blockchain is secondary
    }

    set((state) => ({ cashflows: [normalized, ...state.cashflows] }))
    console.log('[CashflowStore] addCashflow success', { id: normalized.id })

    return normalized
  },
  updateCashflow: async (id, payload) => {
    console.log('[CashflowStore] updateCashflow start', { id, payload })
    const existing = get().cashflows.find((cf) => cf.id === id)

    if (!existing) {
      throw new Error('Cashflow entry not found')
    }

    const updates = buildUpdatePayload(payload)

    if (payload.name !== undefined) {
      if (existing.sourceTable === INCOME_TABLE) {
        updates.income_type = payload.name
      } else {
        updates.expense_category = payload.name
      }
    }

    if (existing.sourceTable === INCOME_TABLE) {
      delete updates.description
    }

    const { data, error } = await supabase
      .from(existing.sourceTable)
      .update(updates)
      .eq('id', existing.sourceId)
      .select()
      .single()

    if (error) {
      console.error('[CashflowStore] updateCashflow error', error)
      throw new Error(error.message)
    }

    const updatedRow = (data ?? null) as IncomeRow | ExpenseRow | null

    if (!updatedRow) {
      return null
    }

    const normalized =
      existing.sourceTable === INCOME_TABLE
        ? mapIncomeRow(updatedRow as IncomeRow)
        : mapExpenseRow(updatedRow as ExpenseRow)

    set((state) => ({
      cashflows: state.cashflows.map((cf) => (cf.id === id ? normalized : cf)),
    }))

    console.log('[CashflowStore] updateCashflow success', { id })
    return normalized
  },
  deleteCashflow: async (id) => {
    console.log('[CashflowStore] deleteCashflow start', { id })
    const existing = get().cashflows.find((cf) => cf.id === id)

    if (!existing) {
      throw new Error('Cashflow entry not found')
    }

    // Delete from Supabase
    const { error } = await supabase
      .from(existing.sourceTable)
      .delete()
      .eq('id', existing.sourceId)

    if (error) {
      console.error('[CashflowStore] deleteCashflow error', error)
      throw new Error(error.message)
    }

    // Also delete from blockchain
    try {
      const blockchainTxns = await getBlockchainTransactions()
      
      // Find matching transaction by amount, category name, and type
      const matchingTx = blockchainTxns.find(tx => 
        tx.amount === existing.amount && 
        tx.category === existing.name &&
        tx.type === existing.category
      )
      
      if (matchingTx) {
        await deleteBlockchainTransaction(matchingTx.id)
        console.log('[CashflowStore] Blockchain transaction deleted:', matchingTx.id)
      } else {
        console.warn('[CashflowStore] No matching blockchain transaction found')
      }
    } catch (blockchainError) {
      console.warn('[CashflowStore] Blockchain delete failed (non-critical):', blockchainError)
      // Don't throw - Supabase delete succeeded, blockchain is secondary
    }

    set((state) => ({
      cashflows: state.cashflows.filter((cf) => cf.id !== id),
    }))
    console.log('[CashflowStore] deleteCashflow success', { id })
  },
}))