import { publicStockData } from '../../../../../lib/publicStockData';
import AnalysisContent from './AnalysisContent';

// Fetch before rendering: the same interactive components now produce complete
// HTML on the server, including closed <details> explanations and components.
export default async function CompanyAnalysis({ params }) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  const result = await publicStockData(ticker);
  const initialData = result && !result.error ? result : null;
  return <AnalysisContent key={ticker} ticker={ticker} initialData={initialData} />;
}
