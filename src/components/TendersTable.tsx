import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useKeywords } from "@/contexts/KeywordsContext";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  body: string;
  client: string;
  deadline: string;
  cpv_codes: string[];
  score: number;
  matched_keywords: MatchedKeyword[];
  published_date: string;
  doffin_url: string;
}

export const TendersTable = () => {
  const { keywords, loading: keywordsLoading } = useKeywords();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"score" | "published-new" | "published-old" | "deadline-new" | "deadline-old">("score");
  const [minScore, setMinScore] = useState<string>("1");

  useEffect(() => {
    if (!keywordsLoading) {
      fetchTenders();
    }
  }, [sortBy, minScore, keywords, keywordsLoading]);

  const recalculateTenderScore = (tender: any): Tender => {
    const searchText = `${tender.title} ${tender.body}`.toLowerCase();
    
    let score = 0;
    const matchedKeywords: MatchedKeyword[] = [];

    for (const kw of keywords) {
      if (searchText.includes(kw.keyword.toLowerCase())) {
        const weight = kw.category === 'negative' ? -kw.weight : kw.weight;
        score += weight;
        matchedKeywords.push({
          keyword: kw.keyword,
          weight: kw.weight,
          category: kw.category
        });
      }
    }

    return {
      ...tender,
      score,
      matched_keywords: matchedKeywords
    };
  };

  const fetchTenders = async () => {
    setLoading(true);
    
    // Fetch all tenders without score filter initially
    let query = supabase
      .from('tenders')
      .select('*');

    // Don't apply deadline sorting in query - we'll do it manually after
    switch (sortBy) {
      case 'published-new':
        query = query.order('published_date', { ascending: false });
        break;
      case 'published-old':
        query = query.order('published_date', { ascending: true });
        break;
      default:
        // For score and deadline sorting, we'll sort after recalculation
        break;
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tenders:', error);
    } else {
      // Recalculate scores based on session keywords
      const recalculatedTenders = (data || [])
        .map(recalculateTenderScore)
        .filter(tender => {
          // Apply new scoring rules:
          // 1. 1 keyword match: Only show if weight >= 3
          // 2. 2 keyword matches: Show if totalScore >= 4
          // 3. 3+ keyword matches: Always show
          const numMatches = tender.matched_keywords.length;
          
          if (numMatches === 0) return false;
          
          if (numMatches === 1) {
            return tender.matched_keywords[0].weight >= 3 && tender.score >= parseInt(minScore);
          } else if (numMatches === 2) {
            return tender.score >= 4 && tender.score >= parseInt(minScore);
          } else {
            // 3+ matches: always show if meets minScore
            return tender.score >= parseInt(minScore);
          }
        });

      // Sort by score or deadline if needed
      if (sortBy === 'score') {
        recalculatedTenders.sort((a, b) => b.score - a.score);
      } else if (sortBy === 'deadline-new' || sortBy === 'deadline-old') {
        recalculatedTenders.sort((a, b) => {
          // Treat null/undefined deadlines as far future dates
          const dateA = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
          const dateB = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
          
          return sortBy === 'deadline-new' ? dateB - dateA : dateA - dateB;
        });
      }

      setTenders(recalculatedTenders);
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

  // Find the two highest unique scores
  const getTopTwoScores = () => {
    const uniqueScores = [...new Set(tenders.map(t => t.score))].sort((a, b) => b - a);
    return uniqueScores.slice(0, 2);
  };

  const isTopScore = (score: number) => {
    const topScores = getTopTwoScores();
    return topScores.includes(score);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Sort by:</label>
          <Select value={sortBy} onValueChange={(v: "score" | "published-new" | "published-old" | "deadline-new" | "deadline-old") => setSortBy(v)}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Highest Score</SelectItem>
              <SelectItem value="published-new">Published - New to Old</SelectItem>
              <SelectItem value="published-old">Published - Old to New</SelectItem>
              <SelectItem value="deadline-new">Deadline - Soon to Late</SelectItem>
              <SelectItem value="deadline-old">Deadline - Late to Soon</SelectItem>
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
              <SelectItem value="1">1+</SelectItem>
              <SelectItem value="2">2+</SelectItem>
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
              <TableHead className="w-16">Link</TableHead>
              <TableHead className="w-[35%]">Title</TableHead>
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
                <TableCell colSpan={8} className="text-center py-8">
                  Loading tenders...
                </TableCell>
              </TableRow>
            ) : tenders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No tenders found. Try adjusting the filters or fetch new tenders.
                </TableCell>
              </TableRow>
            ) : (
              tenders.map((tender) => (
                <TableRow 
                  key={tender.id}
                  className={isTopScore(tender.score) ? "bg-primary/10 hover:bg-primary/15" : ""}
                >
                  <TableCell>
                    <a
                      href={tender.doffin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center text-primary hover:text-primary/80"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="line-clamp-2 cursor-help">{tender.title}</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md">
                        <p>{tender.title}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-sm">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate block cursor-help">{tender.client || "N/A"}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{tender.client || "N/A"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
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
                      {tender.matched_keywords?.sort((a, b) => b.weight - a.weight).map((kw, idx) => (
                        <Badge
                          key={idx}
                          variant={kw.category === 'positive' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {kw.keyword}
                        </Badge>
                      ))}
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
    </TooltipProvider>
  );
};
