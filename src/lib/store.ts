import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { createBlockchainTransaction, getBlockchainTransactions } from '@/lib/blockchain'

const INCOME_TABLE = 'income_transaction'
const EXPENSE_TABLE = 'expense_transaction'
const PROFILE_TABLE = 'profiles'

type SourceTable = typeof INCOME_TABLE | typeof EXPENSE_TABLE

type ProfileRow = {
  id: string
  branch_id: number | null
  org_id: string | null
  role: string | null
}

type IncomeRow = {
  id: number
  branch_id: number | null
  user_id: string | null
  org_id: string | null
  created_at: string | null
  amount: number | null
  income_type: string | null
  cashflow_id: number | null
}

type ExpenseRow = {
  id: number
  branch_id: number | null
  user_id: string | null
  org_id: string | null
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
  orgId: string | null
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
  userRole: string | null
  fetchCashflows: () => Promise<void>
  addCashflow: (payload: CashflowInput) => Promise<Cashflow | null>
  updateCashflow: (
    id: string,
    payload: Partial<CashflowInput>
  ) => Promise<Cashflow | null>
  deleteCashflow: (id: string) => Promise<void>
  refundCashflow: (id: string, reason?: string) => Promise<void>
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
  orgId: row.org_id ?? null,
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
  orgId: row.org_id ?? null,
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
    .select('id, branch_id, org_id, role')
    .eq('id', user.id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const profile = (data ?? null) as ProfileRow | null

  if (!profile) {
    throw new Error('Profile not found')
  }

  if (profile.role !== 'admin' && !profile.branch_id) {
    throw new Error('Your profile is missing a branch assignment')
  }

  return {
    userId: user.id,
    branchId: profile.branch_id,
    orgId: profile.org_id,
    role: profile.role || 'user'
  }
}

const buildInsertPayload = (
  payload: CashflowInput,
  branchId: number | null,
  userId: string,
  orgId: string | null,
): Record<string, unknown> => {
  const base = {
    branch_id: branchId,
    user_id: userId,
    org_id: orgId,
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

const buildAmendmentDescription = (
  original: Cashflow,
  updated: Cashflow,
  originalTxId?: string
): string => {
  const changes: string[] = []

  if (original.amount !== updated.amount) {
    changes.push(`Amount: ₱${original.amount.toLocaleString()} → ₱${updated.amount.toLocaleString()}`)
  }
  if (original.name !== updated.name) {
    changes.push(`Category: ${original.name} → ${updated.name}`)
  }
  if (original.date !== updated.date) {
    const oldDate = new Date(original.date).toLocaleDateString()
    const newDate = new Date(updated.date).toLocaleDateString()
    changes.push(`Date: ${oldDate} → ${newDate}`)
  }

  const changesText = changes.length > 0 ? changes.join(' | ') : 'No value changes'
  const refText = originalTxId ? ` | Ref: ${originalTxId}` : ''

  return `[AMENDMENT] ${changesText}${refText}`
}

export const useCashflowStore = create<CashflowStore>((set, get) => ({
  cashflows: [],
  isLoading: false,
  error: null,
  userRole: null,
  fetchCashflows: async () => {
    set({ isLoading: true, error: null })
    console.log('[CashflowStore] fetchCashflows start')

    try {
      const { branchId, orgId, role } = await ensureProfile()

      set({ userRole: role })

      let incomeQuery = supabase
        .from(INCOME_TABLE)
        .select('*')
        .order('created_at', { ascending: false })

      let expenseQuery = supabase
        .from(EXPENSE_TABLE)
        .select('*')
        .order('created_at', { ascending: false })

      if (role === 'admin') {
        if (orgId) {
          incomeQuery = incomeQuery.eq('org_id', orgId)
          expenseQuery = expenseQuery.eq('org_id', orgId)
        }
        console.log('[CashflowStore] Admin mode: fetching all org transactions')
      } else {
        if (branchId) {
          incomeQuery = incomeQuery.eq('branch_id', branchId)
          expenseQuery = expenseQuery.eq('branch_id', branchId)
        }
        console.log('[CashflowStore] User mode: fetching branch transactions only')
      }

      const [incomeResult, expenseResult] = await Promise.all([
        incomeQuery,
        expenseQuery,
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
        role,
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

    const { branchId, userId, orgId } = await ensureProfile()

    console.log('[CashflowStore] Profile data:', { branchId, userId, orgId })

    const insertPayload = buildInsertPayload(payload, branchId, userId, orgId)
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

    try {
      await createBlockchainTransaction({
        smeId: `${orgId}-${branchId}`,
        type: payload.category,
        amount: payload.amount,
        category: payload.name,
        description: payload.description || '',
        date: payload.date,
      })
      console.log('[CashflowStore] Blockchain transaction recorded')
    } catch (blockchainError) {
      console.warn('[CashflowStore] Blockchain save failed (non-critical):', blockchainError)
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

    try {
      const blockchainTxns = await getBlockchainTransactions()

      const originalTx = blockchainTxns.find(tx =>
        tx.amount === existing.amount &&
        tx.category === existing.name &&
        tx.type === existing.category
      )

      const amendmentDescription = buildAmendmentDescription(
        existing,
        normalized,
        originalTx?.id
      )

      const { branchId, orgId } = await ensureProfile()

      await createBlockchainTransaction({
        smeId: `${orgId}-${branchId}`,
        type: normalized.category,
        amount: normalized.amount,
        category: normalized.name,
        description: amendmentDescription,
        date: normalized.date,
      })

      console.log('[CashflowStore] Blockchain amendment record created:', amendmentDescription)
    } catch (blockchainError) {
      console.warn('[CashflowStore] Blockchain amendment failed (non-critical):', blockchainError)
    }

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

    const { error } = await supabase
      .from(existing.sourceTable)
      .delete()
      .eq('id', existing.sourceId)

    if (error) {
      console.error('[CashflowStore] deleteCashflow error', error)
      throw new Error(error.message)
    }

    try {
      const blockchainTxns = await getBlockchainTransactions()

      const originalTx = blockchainTxns.find(tx =>
        tx.amount === existing.amount &&
        tx.category === existing.name &&
        tx.type === existing.category
      )

      const { branchId, orgId } = await ensureProfile()

      await createBlockchainTransaction({
        smeId: `${orgId}-${branchId}`,
        type: existing.category,
        amount: 0,
        category: existing.name,
        description: `[DELETED] Original amount: ₱${existing.amount.toLocaleString()} | Ref: ${originalTx?.id || 'unknown'}`,
        date: new Date().toISOString(),
      })

      console.log('[CashflowStore] Blockchain deletion record created')
    } catch (blockchainError) {
      console.warn('[CashflowStore] Blockchain deletion record failed (non-critical):', blockchainError)
    }

    set((state) => ({
      cashflows: state.cashflows.filter((cf) => cf.id !== id),
    }))
    console.log('[CashflowStore] deleteCashflow success', { id })
  },

  // ── REFUND ──────────────────────────────────────────────────────────────────
  refundCashflow: async (id, reason) => {
    console.log('[CashflowStore] refundCashflow start', { id, reason })
    const existing = get().cashflows.find((cf) => cf.id === id)

    if (!existing) {
      throw new Error('Cashflow entry not found')
    }

    // Insert a new row in Supabase as a refund entry (original stays untouched)
    const { branchId, userId, orgId } = await ensureProfile()

    const refundName = `[REFUND] ${existing.name}`
    const refundDescription = reason
      ? `[REFUND] Reason: ${reason} | Original amount: ₱${existing.amount.toLocaleString()}`
      : `[REFUND] Original amount: ₱${existing.amount.toLocaleString()}`

    const insertPayload: Record<string, unknown> = {
      branch_id: branchId,
      user_id: userId,
      org_id: orgId,
      amount: existing.amount,
      created_at: new Date().toISOString(),
      cashflow_id: null,
    }

    // Refund reverses the original: income refund goes to expense table, expense refund goes to income table
    const refundTable = existing.sourceTable === INCOME_TABLE ? EXPENSE_TABLE : INCOME_TABLE

    if (refundTable === INCOME_TABLE) {
      insertPayload.income_type = refundName
    } else {
      insertPayload.expense_category = refundName
      insertPayload.description = refundDescription
    }

    const { data, error } = await supabase
      .from(refundTable)
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      console.error('[CashflowStore] refundCashflow supabase error', error)
      throw new Error(error.message)
    }

    const inserted = (data ?? null) as IncomeRow | ExpenseRow | null

    if (!inserted) {
      return
    }

    const normalized =
      refundTable === INCOME_TABLE
        ? mapIncomeRow(inserted as IncomeRow)
        : mapExpenseRow(inserted as ExpenseRow)

    // Record refund on blockchain — original stays, this is appended as [REFUND]
    try {
      const blockchainTxns = await getBlockchainTransactions()

      const originalTx = blockchainTxns.find(tx =>
        tx.amount === existing.amount &&
        tx.category === existing.name &&
        tx.type === existing.category
      )

      await createBlockchainTransaction({
        smeId: `${orgId}-${branchId}`,
        type: refundTable === INCOME_TABLE ? 'income' : 'expense',
        amount: existing.amount,
        category: refundName,
        description: `${refundDescription} | Ref: ${originalTx?.id || 'unknown'}`,
        date: new Date().toISOString(),
      })

      console.log('[CashflowStore] Blockchain refund record created')
    } catch (blockchainError) {
      console.warn('[CashflowStore] Blockchain refund record failed (non-critical):', blockchainError)
    }

    // Add the refund entry to the store so UI updates immediately
    set((state) => ({ cashflows: [normalized, ...state.cashflows] }))
    console.log('[CashflowStore] refundCashflow success', { id })
  },
}))
