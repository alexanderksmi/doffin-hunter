import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

interface Keyword {
  id: string;
  keyword: string;
  weight: number;
  category: 'positive' | 'negative';
}

const Keywords = () => {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newWeight, setNewWeight] = useState("1");
  const [newCategory, setNewCategory] = useState<"positive" | "negative">("positive");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchKeywords();
  }, []);

  const fetchKeywords = async () => {
    const { data, error } = await supabase
      .from('keywords')
      .select('*')
      .order('category', { ascending: true })
      .order('keyword', { ascending: true });

    if (error) {
      toast({
        title: "Feil",
        description: "Kunne ikke hente nøkkelord",
        variant: "destructive",
      });
    } else {
      setKeywords(data || []);
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) {
      toast({
        title: "Feil",
        description: "Nøkkelord kan ikke være tomt",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('keywords')
      .insert({
        keyword: newKeyword.trim(),
        weight: parseInt(newWeight),
        category: newCategory,
      });

    setLoading(false);

    if (error) {
      toast({
        title: "Feil",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Suksess",
        description: "Nøkkelord lagt til",
      });
      setNewKeyword("");
      setNewWeight("1");
      setNewCategory("positive");
      fetchKeywords();
    }
  };

  const handleDeleteKeyword = async (id: string) => {
    const { error } = await supabase
      .from('keywords')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Feil",
        description: "Kunne ikke slette nøkkelord",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Suksess",
        description: "Nøkkelord slettet",
      });
      fetchKeywords();
    }
  };

  const positiveKeywords = keywords.filter(k => k.category === 'positive');
  const negativeKeywords = keywords.filter(k => k.category === 'negative');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-foreground">Administrer Nøkkelord</h1>
          <Button variant="outline" onClick={() => navigate("/")}>
            Tilbake til Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Legg til Nøkkelord</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="keyword">Nøkkelord</Label>
                <Input
                  id="keyword"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="f.eks. programvareutvikling"
                />
              </div>
              <div className="w-32">
                <Label htmlFor="weight">Vekt</Label>
                <Input
                  id="weight"
                  type="number"
                  min="1"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                />
              </div>
              <div className="w-40">
                <Label htmlFor="category">Kategori</Label>
                <Select value={newCategory} onValueChange={(v: "positive" | "negative") => setNewCategory(v)}>
                  <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="positive">Positiv</SelectItem>
                  <SelectItem value="negative">Negativ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddKeyword} disabled={loading}>
                Legg til
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Positive Nøkkelord
                <Badge variant="default">{positiveKeywords.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nøkkelord</TableHead>
                    <TableHead className="w-20">Vekt</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positiveKeywords.map((kw) => (
                    <TableRow key={kw.id}>
                      <TableCell>{kw.keyword}</TableCell>
                      <TableCell>{kw.weight}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteKeyword(kw.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {positiveKeywords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Ingen positive nøkkelord ennå
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Negative Nøkkelord
                <Badge variant="destructive">{negativeKeywords.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nøkkelord</TableHead>
                    <TableHead className="w-20">Vekt</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {negativeKeywords.map((kw) => (
                    <TableRow key={kw.id}>
                      <TableCell>{kw.keyword}</TableCell>
                      <TableCell>-{kw.weight}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteKeyword(kw.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {negativeKeywords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Ingen negative nøkkelord ennå
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Keywords;
