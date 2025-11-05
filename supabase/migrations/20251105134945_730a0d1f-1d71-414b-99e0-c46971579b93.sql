-- Add triggers to automatically queue evaluation jobs when keywords change

-- Trigger for minimum_requirements
CREATE TRIGGER trigger_queue_evaluation_on_minimum_requirements
AFTER INSERT OR UPDATE OR DELETE ON public.minimum_requirements
FOR EACH ROW
EXECUTE FUNCTION public.queue_evaluation_job();

-- Trigger for support_keywords
CREATE TRIGGER trigger_queue_evaluation_on_support_keywords
AFTER INSERT OR UPDATE OR DELETE ON public.support_keywords
FOR EACH ROW
EXECUTE FUNCTION public.queue_evaluation_job();

-- Trigger for negative_keywords
CREATE TRIGGER trigger_queue_evaluation_on_negative_keywords
AFTER INSERT OR UPDATE OR DELETE ON public.negative_keywords
FOR EACH ROW
EXECUTE FUNCTION public.queue_evaluation_job();

-- Trigger for cpv_codes
CREATE TRIGGER trigger_queue_evaluation_on_cpv_codes
AFTER INSERT OR UPDATE OR DELETE ON public.cpv_codes
FOR EACH ROW
EXECUTE FUNCTION public.queue_evaluation_job();