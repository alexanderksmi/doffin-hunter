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
    // Check auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      fetchKeywords();
    });
  }, [navigate]);

  const fetchKeywords = async () => {
    const { data, error } = await supabase
      .from('keywords')
      .select('*')
      .order('category', { ascending: true })
      .order('keyword', { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch keywords",
        variant: "destructive",
      });
    } else {
      setKeywords(data || []);
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) {
      toast({
        title: "Error",
        description: "Keyword cannot be empty",
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
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Keyword added",
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
        title: "Error",
        description: "Failed to delete keyword",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Keyword deleted",
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
          <h1 className="text-2xl font-bold text-foreground">Keyword Management</h1>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Add New Keyword</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="keyword">Keyword</Label>
                <Input
                  id="keyword"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="e.g., AI, machine learning"
                />
              </div>
              <div className="w-32">
                <Label htmlFor="weight">Weight</Label>
                <Input
                  id="weight"
                  type="number"
                  min="1"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                />
              </div>
              <div className="w-40">
                <Label htmlFor="category">Category</Label>
                <Select value={newCategory} onValueChange={(v: "positive" | "negative") => setNewCategory(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddKeyword} disabled={loading}>
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Positive Keywords
                <Badge variant="default">{positiveKeywords.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead className="w-20">Weight</TableHead>
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
                        No positive keywords yet
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
                Negative Keywords
                <Badge variant="destructive">{negativeKeywords.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead className="w-20">Weight</TableHead>
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
                        No negative keywords yet
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
