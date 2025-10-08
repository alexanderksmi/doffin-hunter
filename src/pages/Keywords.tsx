import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Trash2, RefreshCw } from "lucide-react";
import { useKeywords } from "@/contexts/KeywordsContext";

const Keywords = () => {
  const { keywords, addKeywordToDatabase, deleteKeywordFromDatabase, resetToStandard, loading } = useKeywords();
  const [newKeyword, setNewKeyword] = useState("");
  const [newWeight, setNewWeight] = useState("1");
  const [newCategory, setNewCategory] = useState<"positive" | "negative">("positive");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("authenticated");
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
  }, [navigate]);

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) {
      toast({
        title: "Feil",
        description: "Nøkkelord kan ikke være tomt",
        variant: "destructive",
      });
      return;
    }

    try {
      await addKeywordToDatabase({
        keyword: newKeyword.trim(),
        weight: parseInt(newWeight),
        category: newCategory,
      });

      toast({
        title: "Suksess",
        description: "Nøkkelord lagret permanent til databasen",
      });
      
      setNewKeyword("");
      setNewWeight("1");
      setNewCategory("positive");
    } catch (error: any) {
      toast({
        title: "Feil",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteKeyword = async (id: string) => {
    try {
      await deleteKeywordFromDatabase(id);
      toast({
        title: "Suksess",
        description: "Nøkkelord slettet permanent fra databasen",
      });
    } catch (error: any) {
      toast({
        title: "Feil",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReset = async () => {
    await resetToStandard();
    toast({
      title: "Tilbakestilt",
      description: "Nøkkelord tilbakestilt til standard",
    });
  };

  const positiveKeywords = keywords.filter(k => k.category === 'positive');
  const negativeKeywords = keywords.filter(k => k.category === 'negative');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Administrer Nøkkelord</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Dette er standard-nøkkelord som brukes på nettsiden
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tilbakestill
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              Tilbake til Dashboard
            </Button>
          </div>
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
