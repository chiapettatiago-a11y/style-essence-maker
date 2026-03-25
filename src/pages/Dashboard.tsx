import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, LogOut, Loader2, Trash2, Sparkles, ArrowRight, Calendar } from "lucide-react";
import monograma from "@/assets/monograma.png";
import { useToast } from "@/hooks/use-toast";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, created_at, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createProduct = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("products")
        .insert({ name, user_id: user!.id })
        .select("id")
        .single();
      if (error) throw error;

      const { error: weekError } = await supabase
        .from("weekly_launches")
        .insert({ product_id: data.id, label: "Semana 1" });
      if (weekError) throw weekError;

      return data.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false);
      setNewName("");
      navigate(`/project/${id}?new=1`);
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const hasProducts = products && products.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <img src={monograma} alt="Monograma" className="h-5 brightness-0 invert dark:invert neutral:invert-0" />
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <div className="w-px h-5 bg-border" />
            <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        ) : !hasProducts ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center py-20 space-y-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center space-y-3 max-w-lg">
              <h1 className="text-3xl font-bold tracking-tight">
                Bem-vindo ao Fashion AI Studio
              </h1>
              <p className="text-muted-foreground leading-relaxed">
                Crie lookbooks profissionais com IA. Faça upload das fotos no cabide,
                escolha o modelo e gere imagens editoriais em poucos cliques.
              </p>
            </div>
            <Button
              size="lg"
              className="gap-2"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4" /> Criar meu primeiro produto
            </Button>
          </div>
        ) : (
          /* ── Product list ── */
          <>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Meus Produtos</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {products.length} produto{products.length !== 1 ? "s" : ""} cadastrado{products.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> Novo Produto
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="group relative rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => navigate(`/project/${p.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{p.name}</h3>
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(p.updated_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute bottom-3 right-3 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProduct.mutate(p.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Produto</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) createProduct.mutate(newName.trim());
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nome do produto</Label>
              <Input
                placeholder="Ex: Vestido TR001"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={createProduct.isPending || !newName.trim()}>
              {createProduct.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
