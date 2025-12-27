import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Database, Play, Eye, Loader2, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function DataSeeding() {
  const { toast } = useToast();
  const [source, setSource] = useState('reddit');
  const [subreddit, setSubreddit] = useState('changemyview');
  const [postLimit, setPostLimit] = useState(10);
  const [opinionsPerPost, setOpinionsPerPost] = useState(10);
  
  // AI Generate state
  const [topicTitle, setTopicTitle] = useState('');
  const [opinionCount, setOpinionCount] = useState(10);
  
  // Summary generation state
  const [isGeneratingSummaries, setIsGeneratingSummaries] = useState(false);

  // Fetch available sources
  const { data: sources } = useQuery({
    queryKey: ['/api/admin/seeding/sources'],
  });

  // Fetch job history
  const { data: jobs, refetch: refetchJobs } = useQuery({
    queryKey: ['/api/admin/seeding/jobs'],
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/seeding/preview', {
        source,
        config: { subreddit, postLimit: 2, opinionsPerPost: 3 },
      });
      return res.json();
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/seeding/import', {
        source,
        config: { subreddit, postLimit, opinionsPerPost },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/topics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/opinions'] });
      refetchJobs();
      toast({
        title: 'Import Complete!',
        description: 'Data has been successfully imported.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import data',
        variant: 'destructive',
      });
    },
  });

  // AI Generate mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/seeding/generate', {
        topicTitle: topicTitle.trim(),
        opinionCount,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/topics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/opinions'] });
      refetchJobs();
      setTopicTitle(''); // Clear form
      toast({
        title: 'Generation Complete!',
        description: 'Opinions have been successfully generated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate opinions',
        variant: 'destructive',
      });
    },
  });

  // Summary generation mutation
  const generateSummariesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/summaries/generate');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Summary Generation Complete!',
        description: data.message || `Generated ${data.generated} summaries, refreshed ${data.refreshed}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate summaries',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsGeneratingSummaries(false);
    },
  });

  const subreddits = (sources as any)?.sources?.[0]?.subreddits || [
    { id: 'changemyview', name: 'r/changemyview' },
    { id: 'unpopularopinion', name: 'r/unpopularopinion' },
    { id: 'TrueOffMyChest', name: 'r/TrueOffMyChest' },
    { id: 'AmItheAsshole', name: 'r/AmItheAsshole' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Summary Management
          </CardTitle>
          <CardDescription>
            Manually trigger AI summary generation for all topics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => {
              setIsGeneratingSummaries(true);
              generateSummariesMutation.mutate();
            }}
            disabled={isGeneratingSummaries}
          >
            {isGeneratingSummaries ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Summaries...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate All Summaries
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Seeding
          </CardTitle>
          <CardDescription>
            Import debate data from external sources or generate AI opinions for topics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Source</label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reddit">Reddit</SelectItem>
                  <SelectItem value="ai_generate">AI Generate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {source === 'reddit' && (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">Subreddit</label>
                  <Select value={subreddit} onValueChange={setSubreddit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {subreddits.map((sub: any) => (
                        <SelectItem key={sub.id} value={sub.id}>
                          {sub.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Posts to Import</label>
                  <Input
                    type="number"
                    value={postLimit}
                    onChange={(e) => setPostLimit(Number(e.target.value))}
                    min={1}
                    max={50}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Opinions per Post</label>
                  <Input
                    type="number"
                    value={opinionsPerPost}
                    onChange={(e) => setOpinionsPerPost(Number(e.target.value))}
                    min={1}
                    max={10}
                  />
                </div>
              </>
            )}

            {source === 'ai_generate' && (
              <>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium mb-2 block">Topic Title</label>
                  <Input
                    placeholder="e.g., Universal Basic Income"
                    value={topicTitle}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter a neutral topic title for debate
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Number of Opinions</label>
                  <Input
                    type="number"
                    value={opinionCount}
                    onChange={(e) => setOpinionCount(Number(e.target.value))}
                    min={1}
                    max={50}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Generate 1-50 unique opinions
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            {source === 'reddit' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => previewMutation.mutate()}
                  disabled={previewMutation.isPending || importMutation.isPending}
                >
                  {previewMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  Preview
                </Button>
                <Button
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending || previewMutation.isPending}
                >
                  {importMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {importMutation.isPending ? 'Importing...' : 'Start Import'}
                </Button>
              </>
            )}

            {source === 'ai_generate' && (
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !topicTitle.trim() || opinionCount < 1 || opinionCount > 50}
                className="w-full md:w-auto"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {generateMutation.isPending ? 'Generating...' : 'Generate Opinions'}
              </Button>
            )}
          </div>

          {(importMutation.isSuccess || generateMutation.isSuccess) && (
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-md border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <p className="text-green-700 dark:text-green-300 font-medium">
                  {source === 'ai_generate' ? 'Generation Complete!' : 'Import Complete!'}
                </p>
              </div>
              <div className="flex gap-4 mt-2">
                <Badge variant="secondary">
                  {(importMutation.data || generateMutation.data)?.topicsCreated || 0} topics created
                </Badge>
                {(importMutation.data || generateMutation.data)?.topicsReused > 0 && (
                  <Badge variant="secondary">
                    {(importMutation.data || generateMutation.data)?.topicsReused || 0} topics reused
                  </Badge>
                )}
                <Badge variant="secondary">
                  {(importMutation.data || generateMutation.data)?.opinionsCreated || 0} opinions
                </Badge>
                <Badge variant="secondary">
                  {(importMutation.data || generateMutation.data)?.usersCreated || 0} users
                </Badge>
              </div>
              {(importMutation.data?.errors && importMutation.data.errors.length > 0) || 
               (generateMutation.data?.errors && generateMutation.data.errors.length > 0) ? (
                <div className="mt-2">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {((importMutation.data || generateMutation.data)?.errors?.length || 0)} error(s) occurred
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {(importMutation.isError || generateMutation.isError) && (
            <div className="bg-red-50 dark:bg-red-950 p-4 rounded-md border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <p className="text-red-700 dark:text-red-300 font-medium">
                  {(importMutation.error || generateMutation.error) instanceof Error 
                    ? (importMutation.error || generateMutation.error)?.message 
                    : (source === 'ai_generate' ? 'Generation failed' : 'Import failed')}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Results */}
      {previewMutation.data && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Estimated cost: {previewMutation.data.estimatedCost} ({previewMutation.data.estimatedApiCalls} API calls)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {previewMutation.data.posts?.map((post: any, i: number) => (
                <div key={i} className="border rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Original Title:</p>
                    <p className="font-medium">{post.originalTitle}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Neutral Topic:</p>
                    <p className="font-medium text-primary">{post.neutralTopic}</p>
                    {post.matchedExistingTopic && (
                      <Badge variant="outline" className="mt-1">
                        Matches: {post.matchedExistingTopic}
                      </Badge>
                    )}
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Sample Opinions:</p>
                    <div className="space-y-2">
                      {post.sampleOpinions?.map((opinion: any, j: number) => (
                        <div key={j} className="bg-muted/50 p-3 rounded text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {opinion.intensity}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {opinion.stance}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">Transformed:</p>
                          <p className="mb-2">{opinion.transformed}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job History */}
      <Card>
        <CardHeader>
          <CardTitle>Import History</CardTitle>
          <CardDescription>Past data seeding jobs</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs && Array.isArray(jobs) && jobs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Config</TableHead>
                  <TableHead>Topics</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Opinions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(jobs as any[]).map((job: any) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      {job.source === 'ai_generate' ? 'AI Generate' : job.source}
                    </TableCell>
                    <TableCell className="text-sm">
                      {job.sourceConfig?.subreddit || job.sourceConfig?.topicTitle || 'N/A'}
                    </TableCell>
                    <TableCell>{job.topicsCreated || 0}</TableCell>
                    <TableCell>{job.usersCreated || 0}</TableCell>
                    <TableCell>{job.opinionsCreated || 0}</TableCell>
                    <TableCell>
                      <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No import history yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

