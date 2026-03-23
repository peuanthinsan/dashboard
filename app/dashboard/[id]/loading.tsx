import LoadingState from 'app/dashboards/LoadingState';
import { pageContent } from 'app/ui/design-tokens';

export default function DashboardIdLoading() {
  return (
    <div className={pageContent}>
      <LoadingState />
    </div>
  );
}
