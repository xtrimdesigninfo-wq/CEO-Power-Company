import { useQuery } from '@tanstack/react-query';
import { dataService } from '../services/dataService';
import { CompanySettings } from '../types';
import { DEFAULT_WHATSAPP_NUMBER } from '../lib/whatsapp';

const FALLBACK_SETTINGS: CompanySettings = {
  whatsapp_number: DEFAULT_WHATSAPP_NUMBER,
  company_name: 'CEO Power Company',
  company_address: '20 Oguta Road, Onitsha, Anambra State',
  support_email: 'info@ceopowercompany.org',
  tagline: 'Power Without Limits',
  est_year: '2014',
  low_stock_threshold: '10',
};

export function useCompanySettings() {
  const query = useQuery<CompanySettings>({
    queryKey: ['company-settings'],
    queryFn: () => dataService.getSettings(),
    staleTime: 1000 * 60 * 5,
  });

  return {
    settings: query.data || FALLBACK_SETTINGS,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
