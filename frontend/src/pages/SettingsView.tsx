import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, UserPlus, Shield, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { whitelistApi } from '@/lib/api'
import { useToast } from '@/lib/toast-context'
import type { ApiError } from '@/lib/types'

export function SettingsView() {
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
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-primary/20 text-primary">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Access Control</h1>
          <p className="text-muted-foreground">Manage users who are allowed to access this SynoBridge instance.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        <div className="space-y-4">
          <div className="glass-card p-6 rounded-2xl border border-white/10">
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
            <p className="text-[10px] text-muted-foreground mt-4 leading-relaxed">
              Note: Users in the root .env whitelist are always allowed and won't appear here.
            </p>
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
            <h2 className="text-sm font-semibold">Whitelisted Users</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {emails.length} Users
            </span>
          </div>

          <div className="divide-y divide-white/5">
            {isLoading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm">Loading whitelist...</p>
              </div>
            ) : emails.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground italic">
                <p className="text-sm text-center">No users whitelisted in the database yet.<br/>Access is currently restricted to .env users.</p>
              </div>
            ) : (
              emails.map((item) => (
                <div key={item.ID} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold">
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
    </div>
  )
}
