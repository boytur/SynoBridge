import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, UserPlus, Shield, Loader2, Moon, Sun, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { whitelistApi } from '@/lib/api'
import { useToast } from '@/lib/toast-context'
import type { ApiError } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props {
  open: boolean
  onClose: () => void
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
}

export function SettingsView({ open, onClose, theme, setTheme }: Props) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [newEmail, setNewEmail] = useState('')

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['whitelist'],
    queryFn: whitelistApi.getAll,
  })

  const addEmail = useMutation({
    mutationFn: whitelistApi.add,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whitelist'] })
      setNewEmail('')
      toast({ title: 'Email added to whitelist' })
    },
    onError: (err) => {
      const apiErr = err as ApiError
      toast({ 
        title: 'Failed to add email', 
        description: apiErr.response?.data?.error || (err as Error).message,
        variant: 'destructive' 
      })
    }
  })

  const deleteEmail = useMutation({
    mutationFn: whitelistApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whitelist'] })
      toast({ title: 'Email removed from whitelist' })
    }
  })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail) return
    addEmail.mutate(newEmail)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background border-border shadow-2xl">
        <DialogHeader className="p-6 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20 text-primary">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Settings & Access Control</DialogTitle>
                <p className="text-xs text-muted-foreground">Manage your workspace preferences and security.</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
          {/* Theme Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Appearance</h3>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setTheme('light')}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${theme === 'light' ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'bg-muted/50 border-border hover:border-primary/50'}`}
              >
                <div className={`p-3 rounded-xl ${theme === 'light' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}`}>
                  <Sun className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-bold">Light Mode</div>
                  <div className="text-xs text-muted-foreground">Classic bright interface</div>
                </div>
              </button>
              <button 
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'bg-muted/50 border-border hover:border-primary/50'}`}
              >
                <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}`}>
                  <Moon className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-bold">Dark Mode</div>
                  <div className="text-xs text-muted-foreground">Sleek midnight interface</div>
                </div>
              </button>
            </div>
          </section>

          {/* Access Control Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Access Control</h3>
            <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
              <div className="glass-card p-6 rounded-2xl border border-border bg-muted/20">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Add User
                </h2>
                <form onSubmit={handleAdd} className="space-y-3">
                  <Input 
                    placeholder="email@example.com" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    type="email"
                    required
                  />
                  <Button className="w-full" disabled={addEmail.isPending}>
                    {addEmail.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Whitelist Email
                  </Button>
                </form>
              </div>

              <div className="border border-border rounded-2xl overflow-hidden bg-background">
                <div className="p-4 border-b bg-muted/50 flex justify-between items-center">
                  <h2 className="text-sm font-semibold">Whitelisted Users</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold">
                    {emails.length}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {isLoading ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : emails.length === 0 ? (
                    <div className="p-12 text-center italic text-muted-foreground text-sm">
                      No users whitelisted in the database yet.
                    </div>
                  ) : (
                    emails.map((item) => (
                      <div key={item.ID} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20">
                            {item.Email[0].toUpperCase()}
                          </div>
                          <span className="text-sm font-medium">{item.Email}</span>
                        </div>
                        <button
                          onClick={() => deleteEmail.mutate(item.ID)}
                          className="p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
