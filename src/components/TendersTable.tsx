import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { ExternalLink } from "lucide-react";

interface MatchedKeyword {
  keyword: string;
  weight: number;
  category: string;
}

interface Tender {
  id: string;
  doffin_id: string;
  title: string;
  client: string;
  deadline: string;
  cpv_codes: string[];
  score: number;
  matched_keywords: MatchedKeyword[];
  published_date: string;
  doffin_url: string;
}

export const TendersTable = () => {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"newest" | "score">("newest");
  const [minScore, setMinScore] = useState<string>("3");

  useEffect(() => {
    fetchTenders();
  }, [sortBy, minScore]);

  const fetchTenders = async () => {
    setLoading(true);
    
    let query = supabase
      .from('tenders')
      .select('*')
      .gte('score', parseInt(minScore));

    if (sortBy === 'newest') {
      query = query.order('published_date', { ascending: false });
    } else {
      query = query.order('score', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tenders:', error);
    } else {
      // Cast matched_keywords from Json to MatchedKeyword[]
      const tendersWithTypedKeywords = (data || []).map(tender => ({
        ...tender,
        matched_keywords: (tender.matched_keywords as unknown as MatchedKeyword[]) || []
      }));
      setTenders(tendersWithTypedKeywords);
    }
    
    setLoading(false);
  };

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" => {
    if (score >= 5) return "default";
    if (score >= 3) return "secondary";
    return "destructive";
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Sort by:</label>
          <Select value={sortBy} onValueChange={(v: "newest" | "score") => setSortBy(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="score">Highest Score</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Min Score:</label>
          <Select value={minScore} onValueChange={setMinScore}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3+</SelectItem>
              <SelectItem value="4">4+</SelectItem>
              <SelectItem value="5">5+</SelectItem>
              <SelectItem value="6">6+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto text-sm text-muted-foreground">
          {tenders.length} tenders found
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="w-20">Score</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="w-24">Published</TableHead>
              <TableHead>Keywords</TableHead>
              <TableHead>CPV Codes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading tenders...
                </TableCell>
              </TableRow>
            ) : tenders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No tenders found. Try adjusting the filters or fetch new tenders.
                </TableCell>
              </TableRow>
            ) : (
              tenders.map((tender) => (
                <TableRow key={tender.id}>
                  <TableCell>
                    <a
                      href={tender.doffin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <span className="line-clamp-2">{tender.title}</span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell className="text-sm">{tender.client || "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant={getScoreBadgeVariant(tender.score)}>
                      {tender.score}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(tender.deadline)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(tender.published_date)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tender.matched_keywords?.slice(0, 3).map((kw, idx) => (
                        <Badge
                          key={idx}
                          variant={kw.category === 'positive' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {kw.keyword}
                        </Badge>
                      ))}
                      {tender.matched_keywords?.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{tender.matched_keywords.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tender.cpv_codes?.slice(0, 2).map((code, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {code.slice(0, 8)}
                        </Badge>
                      ))}
                      {tender.cpv_codes?.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{tender.cpv_codes.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
