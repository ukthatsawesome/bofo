import { h } from 'preact';
import { useState } from 'preact/hooks';
import { useBills } from '@/features/bills/hooks/useBills';
import { UiButton } from '@/components/ui/UiButton';
import { UiCard } from '@/components/ui/UiCard';
import { UiStatCard } from '@/components/ui/UiStatCard';
import { DataTable } from '@/components/ui/DataTable';
import { BillChart } from './components/BillChart';
import { Plus, Trash2, Edit3, TrendingUp, DollarSign } from 'lucide-preact';
import { formatCurrency, formatNumber, getCurrencyCode } from '@/utils/format';
import { ViewLayout } from '@/components/layout/ViewLayout';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { UiSelect } from '@/components/ui/UiSelect';
import { IconButton } from '@/components/ui/IconButton';

export const BillsPage = () => {
  const { readings, billTypes, isLoading, stats, deleteReading, addReading, updateReading } =
    useBills();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReading, setEditingReading] = useState<any>(null);
  const [formData, setFormData] = useState({
    bill_type_id: '',
    reading_date: new Date().toISOString().split('T')[0],
    units_consumed: '',
    total_cost: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      bill_type_id: '',
      reading_date: new Date().toISOString().split('T')[0],
      units_consumed: '',
      total_cost: '',
      notes: '',
    });
    setEditingReading(null);
  };

  const handleAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (reading: any) => {
    setEditingReading(reading);
    setFormData({
      bill_type_id: reading.bill_type_id?.toString() || '',
      reading_date: reading.reading_date || new Date().toISOString().split('T')[0],
      units_consumed: reading.units_consumed?.toString() || '',
      total_cost: reading.total_cost?.toString() || '',
      notes: reading.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: Event) => {
    e.preventDefault();
    const data = {
      bill_type_id: Number(formData.bill_type_id),
      reading_date: formData.reading_date,
      units_consumed: parseFloat(formData.units_consumed) || 0,
      total_cost: parseFloat(formData.total_cost),
      notes: formData.notes,
    };
    if (editingReading?.id) {
      await updateReading(editingReading.id, data);
    } else {
      await addReading(data);
    }
    setIsModalOpen(false);
    resetForm();
  };

  const HeaderActions = (
    <UiButton icon={<Plus size={18} />} onClick={handleAdd}>
      New Bill Reading
    </UiButton>
  );

  return (
    <ViewLayout
      title="Bills & Subscriptions"
      subtitle="Track your recurring monthly expenses"
      actions={HeaderActions}
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UiStatCard
            label="Total Monthly Cost"
            value={formatNumber(stats.totalCost)}
            icon={DollarSign}
            color="primary"
            trend="up"
            trendValue="+12%"
            currency={getCurrencyCode()}
          />
          <UiStatCard
            label="Average Bill Cost"
            value={formatNumber(stats.avgCost)}
            icon={TrendingUp}
            color="warning"
            currency={getCurrencyCode()}
          />
          <UiStatCard
            label="Active Subscriptions"
            value={stats.count}
            icon={DollarSign}
            color="info"
          />
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Section */}
          <div className="lg:col-span-2">
            <UiCard title="Cost History" subtitle="Last 12 months trends">
              <BillChart data={readings} />
            </UiCard>
          </div>

          {/* Recent Readings List */}
          <div className="lg:col-span-1">
            <UiCard title="Recent Readings" noPadding className="h-full">
              <DataTable
                data={readings.slice(0, 5)}
                isLoading={isLoading}
                keyField="id"
                columns={[
                  {
                    header: 'Bill',
                    accessor: (item: any) => (
                      <div className="flex items-center gap-3">
                        {item.icon ? (
                          <img src={item.icon} className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-surface-active" />
                        )}
                        <span className="font-medium">{item.bill_name || 'Unknown'}</span>
                      </div>
                    ),
                  },
                  {
                    header: 'Amount',
                    accessor: (item) => formatCurrency(item.amount),
                    className: 'text-right font-mono',
                  },
                ]}
              />
            </UiCard>
          </div>
        </div>

        {/* Full History Table */}
        <UiCard title="Reading History">
          <DataTable
            data={readings}
            isLoading={isLoading}
            keyField="id"
            columns={[
              {
                header: 'Date',
                accessor: (row: any) =>
                  row.reading_date ? new Date(row.reading_date).toLocaleDateString() : 'N/A',
              },
              { header: 'Bill', accessor: (row: any) => row.bill_name },
              { header: 'Amount', accessor: (row: any) => formatCurrency(row.amount) },
              {
                header: 'Actions',
                accessor: (row: any) => (
                  <div className="flex gap-1 justify-end">
                    <IconButton
                      icon={Edit3}
                      variant="primary"
                      tooltip="Edit"
                      onClick={() => handleEdit(row)}
                    />
                    <IconButton
                      icon={Trash2}
                      variant="danger"
                      tooltip="Delete"
                      onClick={() => deleteReading(row.id)}
                    />
                  </div>
                ),
                className: 'text-right',
              },
            ]}
          />
        </UiCard>

        {/* Bill Reading Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingReading ? 'Edit Bill Reading' : 'New Bill Reading'}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <UiSelect
              label="Bill Type"
              options={billTypes.map((t: any) => ({ label: t.name, value: t.id }))}
              value={formData.bill_type_id}
              onChange={(e) =>
                setFormData({ ...formData, bill_type_id: (e.target as HTMLSelectElement).value })
              }
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Reading Date"
                type="date"
                value={formData.reading_date}
                onInput={(e) =>
                  setFormData({ ...formData, reading_date: (e.target as HTMLInputElement).value })
                }
                required
              />
              <Input
                label="Total Cost"
                type="number"
                step="0.01"
                value={formData.total_cost}
                onInput={(e) =>
                  setFormData({ ...formData, total_cost: (e.target as HTMLInputElement).value })
                }
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Units Consumed"
                type="number"
                step="0.01"
                value={formData.units_consumed}
                onInput={(e) =>
                  setFormData({ ...formData, units_consumed: (e.target as HTMLInputElement).value })
                }
              />
              <Input
                label="Notes"
                value={formData.notes}
                onInput={(e) =>
                  setFormData({ ...formData, notes: (e.target as HTMLInputElement).value })
                }
              />
            </div>
            <div className="flex gap-3 pt-4 border-t border-border mt-6">
              <UiButton
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </UiButton>
              <UiButton type="submit" variant="primary" className="flex-1">
                {editingReading ? 'Save Changes' : 'Add Reading'}
              </UiButton>
            </div>
          </form>
        </Modal>
      </div>
    </ViewLayout>
  );
};
