const BLOCKCHAIN_API_URL = import.meta.env.VITE_BLOCKCHAIN_API_URL;

export interface BlockchainTransaction {
  id: string;
  smeId: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  blockchainStatus: string;
}

export interface CashflowSummary {
  smeId: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  transactionCount: number;
}

// Health check
export const checkBlockchainHealth = async () => {
  const response = await fetch(`${BLOCKCHAIN_API_URL}/api/health`);
  return response.json();
};

// Get all transactions
export const getBlockchainTransactions = async (): Promise<BlockchainTransaction[]> => {
  const response = await fetch(`${BLOCKCHAIN_API_URL}/api/transactions`);
  return response.json();
};

// Get transactions by SME ID
export const getTransactionsBySME = async (smeId: string): Promise<BlockchainTransaction[]> => {
  const response = await fetch(`${BLOCKCHAIN_API_URL}/api/transactions/sme/${smeId}`);
  return response.json();
};

// Create transaction on blockchain
export const createBlockchainTransaction = async (transaction: {
  smeId: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
}): Promise<BlockchainTransaction> => {
  const response = await fetch(`${BLOCKCHAIN_API_URL}/api/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transaction),
  });
  return response.json();
};

// Get cashflow summary
export const getCashflowSummary = async (smeId: string): Promise<CashflowSummary> => {
  const response = await fetch(`${BLOCKCHAIN_API_URL}/api/summary/${smeId}`);
  return response.json();
};

// Delete transaction
export const deleteBlockchainTransaction = async (id: string) => {
  const response = await fetch(`${BLOCKCHAIN_API_URL}/api/transactions/${id}`, {
    method: 'DELETE',
  });
  return response.json();
};