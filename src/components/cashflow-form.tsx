import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useCashflowStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function CashflowForm() {
  const navigate = useNavigate()
  const { addCashflow } = useCashflowStore()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [transactionType, setTransactionType] = useState<'normal' | 'refund'>('normal')

  const [formData, setFormData] = useState({
    name: '',
    category: 'expense' as 'income' | 'expense',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCategoryChange = (value: 'income' | 'expense') => {
    setFormData((prev) => ({ ...prev, category: value }))
  }

  const handleTransactionTypeChange = (value: 'normal' | 'refund') => {
    setTransactionType(value)
    // Refund reverses category: if expense selected, refund goes as income and vice versa
    if (value === 'refund') {
      setFormData((prev) => ({
        ...prev,
        category: prev.category === 'expense' ? 'income' : 'expense',
      }))
    }
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.amount) {
      toast.error('Error', {
        description: 'Please fill in all required fields.',
      })
      return
    }

    setIsSubmitting(true)

    // Prefix name and description with [REFUND] if type is refund
    const finalName = transactionType === 'refund'
      ? `[REFUND] ${formData.name}`
      : formData.name

    const finalDescription = transactionType === 'refund'
      ? formData.description
        ? `[REFUND] ${formData.description}`
        : `[REFUND] Original amount: ₱${parseFloat(formData.amount).toLocaleString()}`
      : formData.description

    try {
      await addCashflow({
        name: finalName,
        category: formData.category,
        amount: parseFloat(formData.amount),
        date: formData.date,
        description: finalDescription,
      })

      setOpen(false)
      toast.success(
        transactionType === 'refund' ? 'Refund Recorded' : 'Success',
        {
          description:
            transactionType === 'refund'
              ? `Refund of ₱${parseFloat(formData.amount).toLocaleString()} has been recorded and logged to the blockchain audit trail.`
              : 'Cashflow entry has been created successfully.',
        }
      )

      setFormData({
        name: '',
        category: 'expense',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
      })
      setTransactionType('normal')

      navigate('/dashboard')
    } catch (error) {
      const description =
        error instanceof Error
          ? error.message
          : 'Unable to create the cashflow entry.'
      toast.error('Error', { description })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isRefund = transactionType === 'refund'

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Cashflow Entry</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">

          {/* Transaction Type selector */}
          <div className="space-y-2">
            <Label className="text-foreground">Transaction Type *</Label>
            <Select value={transactionType} onValueChange={handleTransactionTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
              </SelectContent>
            </Select>
            {isRefund && (
              <p className="text-xs text-orange-500">
                This entry will be recorded as a <span className="font-mono">[REFUND]</span> on the blockchain audit log. The category has been reversed automatically.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">
                {isRefund ? 'Original Entry Name *' : 'Name *'}
              </Label>
              <Input
                id="name"
                name="name"
                placeholder={isRefund ? 'e.g., Donk sale' : 'e.g., Monthly Salary'}
                value={formData.name}
                onChange={handleChange}
              />
              {isRefund && (
                <p className="text-xs text-muted-foreground">
                  Will be saved as: <span className="font-mono">[REFUND] {formData.name || '...'}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-foreground">
                Category *
              </Label>
              <Select value={formData.category} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
              {isRefund && (
                <p className="text-xs text-muted-foreground">
                  Category reversed from original to offset the amount.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount" className="text-foreground">
                Amount *
              </Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                placeholder="0.00"
                step="0.01"
                value={formData.amount}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date" className="text-foreground">
                Date *
              </Label>
              <Input
                id="date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground">
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              placeholder={
                isRefund
                  ? 'e.g., Customer returned item, duplicate charge...'
                  : 'Add notes about this cashflow entry...'
              }
              value={formData.description}
              onChange={handleChange}
              rows={4}
            />
          </div>

          <div className="flex gap-3 pt-6">
            <AlertDialog open={open} onOpenChange={setOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  className={`flex-1 ${isRefund ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? isRefund ? 'Recording Refund...' : 'Creating...'
                    : isRefund ? 'Record Refund' : 'Create Entry'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogTitle>
                  {isRefund ? 'Confirm Refund' : 'Confirm Creation'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {isRefund
                    ? `This will record a refund of ₱${parseFloat(formData.amount || '0').toLocaleString()} for "${formData.name}". A [REFUND] entry will be appended to the blockchain audit log.`
                    : 'Are you sure you want to create this cashflow entry?'}
                </AlertDialogDescription>
                <div className="flex justify-end gap-2">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className={isRefund ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}
                  >
                    {isSubmitting
                      ? isRefund ? 'Recording...' : 'Creating...'
                      : isRefund ? 'Confirm Refund' : 'Create'}
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </div>

        </div>
      </CardContent>
    </Card>
  )
}