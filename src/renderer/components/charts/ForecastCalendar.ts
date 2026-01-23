/**
 * ForecastCalendar Component
 * 
 * Displays a calendar-based view of cash flow forecasting with:
 * - Daily projected balances
 * - Bill due date markers
 * - Low-balance day warnings
 * - Recurring charge indicators
 */

export interface CalendarDay {
    date: string;
    dayOfMonth: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    projectedBalance: number;
    events: CalendarEvent[];
    isLowBalance: boolean;
}

export interface CalendarEvent {
    type: 'bill' | 'recurring' | 'income';
    name: string;
    amount: number;
}

interface ForecastCalendarProps {
    month: number; // 0-indexed
    year: number;
    timeline: { date: string; balance: number }[];
    bills: { name: string; due_day: number; amount: number }[];
    recurringCharges: { name: string; due_day: number; amount: number; category: string }[];
    lowBalanceThreshold: number;
    formatCurrency: (amount: number) => string;
}

/**
 * Get days in a month
 */
function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

/**
 * Get day of week for first day of month (0 = Sunday)
 */
function getFirstDayOfWeek(year: number, month: number): number {
    return new Date(year, month, 1).getDay();
}

/**
 * Generate calendar grid data
 */
function generateCalendarDays(props: ForecastCalendarProps): CalendarDay[] {
    const { month, year, timeline, bills, recurringCharges, lowBalanceThreshold } = props;

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfWeek(year, month);
    const today = new Date().toISOString().split('T')[0];

    // Create balance lookup map
    const balanceMap = new Map<string, number>();
    for (const day of timeline) {
        balanceMap.set(day.date, day.balance);
    }

    // Get last known balance for fill-forward
    let lastBalance = 0;
    if (timeline.length > 0) {
        lastBalance = timeline[timeline.length - 1]?.balance || 0;
    }

    const days: CalendarDay[] = [];

    // Add empty cells for days before first day of month
    for (let i = 0; i < firstDay; i++) {
        days.push({
            date: '',
            dayOfMonth: 0,
            isCurrentMonth: false,
            isToday: false,
            projectedBalance: 0,
            events: [],
            isLowBalance: false,
        });
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const balance = balanceMap.get(dateStr) ?? lastBalance;

        const events: CalendarEvent[] = [];

        // Add recurring charges due on this day
        for (const rc of recurringCharges) {
            if (rc.due_day === day) {
                events.push({
                    type: 'recurring',
                    name: rc.name,
                    amount: rc.amount,
                });
            }
        }

        // Add bills due on this day
        for (const bill of bills) {
            if (bill.due_day === day) {
                events.push({
                    type: 'bill',
                    name: bill.name,
                    amount: bill.amount,
                });
            }
        }

        days.push({
            date: dateStr,
            dayOfMonth: day,
            isCurrentMonth: true,
            isToday: dateStr === today,
            projectedBalance: balance,
            events,
            isLowBalance: balance < lowBalanceThreshold && balance > 0,
        });
    }

    return days;
}

/**
 * Render a single calendar day cell
 */
function renderDayCell(day: CalendarDay, formatCurrency: (n: number) => string): string {
    if (!day.isCurrentMonth) {
        return '<div class="calendar-day calendar-day--empty"></div>';
    }

    const classes = [
        'calendar-day',
        day.isToday ? 'calendar-day--today' : '',
        day.isLowBalance ? 'calendar-day--low-balance' : '',
        day.events.length > 0 ? 'calendar-day--has-events' : '',
    ].filter(Boolean).join(' ');

    const eventsHtml = day.events.slice(0, 2).map(e => `
    <div class="calendar-event calendar-event--${e.type}" title="${e.name}: ${formatCurrency(e.amount)}">
      ${e.name.substring(0, 12)}${e.name.length > 12 ? '...' : ''}
    </div>
  `).join('');

    const moreEvents = day.events.length > 2
        ? `<div class="calendar-event calendar-event--more">+${day.events.length - 2} more</div>`
        : '';

    return `
    <div class="${classes}" data-date="${day.date}">
      <div class="calendar-day__header">
        <span class="calendar-day__number">${day.dayOfMonth}</span>
        ${day.isLowBalance ? '<i data-lucide="alert-triangle" class="calendar-day__warning"></i>' : ''}
      </div>
      <div class="calendar-day__balance ${day.projectedBalance < 0 ? 'text-danger' : ''}">
        ${formatCurrency(day.projectedBalance)}
      </div>
      <div class="calendar-day__events">
        ${eventsHtml}
        ${moreEvents}
      </div>
    </div>
  `;
}

/**
 * Render the forecast calendar grid
 */
export const ForecastCalendar = (props: ForecastCalendarProps): string => {
    const { month, year, formatCurrency } = props;
    const days = generateCalendarDays(props);

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        .map(d => `<div class="calendar-header-cell">${d}</div>`)
        .join('');

    const dayCells = days.map(d => renderDayCell(d, formatCurrency)).join('');

    // Calculate totals for the month
    const totalBills = props.bills.reduce((sum, b) => sum + b.amount, 0);
    const totalRecurring = props.recurringCharges.reduce((sum, r) => sum + r.amount, 0);
    const lowBalanceDays = days.filter(d => d.isLowBalance).length;

    return `
    <div class="forecast-calendar">
      <div class="calendar-nav">
        <button class="btn-icon" onclick="app.views.forecast.prevMonth()">
          <i data-lucide="chevron-left"></i>
        </button>
        <h3 class="calendar-title">${monthNames[month]} ${year}</h3>
        <button class="btn-icon" onclick="app.views.forecast.nextMonth()">
          <i data-lucide="chevron-right"></i>
        </button>
      </div>
      
      <div class="calendar-summary">
        <div class="calendar-stat">
          <span class="calendar-stat__label">Bills Due</span>
          <span class="calendar-stat__value">${formatCurrency(totalBills)}</span>
        </div>
        <div class="calendar-stat">
          <span class="calendar-stat__label">Subscriptions</span>
          <span class="calendar-stat__value">${formatCurrency(totalRecurring)}</span>
        </div>
        ${lowBalanceDays > 0 ? `
          <div class="calendar-stat calendar-stat--warning">
            <span class="calendar-stat__label">Low Balance Days</span>
            <span class="calendar-stat__value">${lowBalanceDays}</span>
          </div>
        ` : ''}
      </div>
      
      <div class="calendar-grid">
        <div class="calendar-header">
          ${dayHeaders}
        </div>
        <div class="calendar-body">
          ${dayCells}
        </div>
      </div>
      
      <div class="calendar-legend">
        <div class="legend-item"><span class="legend-dot legend-dot--bill"></span> Bill Due</div>
        <div class="legend-item"><span class="legend-dot legend-dot--recurring"></span> Subscription</div>
        <div class="legend-item"><span class="legend-dot legend-dot--low"></span> Low Balance Warning</div>
      </div>
    </div>
  `;
};
