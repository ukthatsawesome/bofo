/**
 * ForecastCalendar Component
 *
 * Displays a calendar-based view of cash flow forecasting.
 */

// ==================== TYPES & INTERFACES ====================

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
  // Navigation event handlers (as strings for onclick attribute)
  onPrevMonth?: string;
  onNextMonth?: string;
  // Localization
  locale?: string;
}

// ==================== CONSTANTS ====================

const CSS_CLASSES = {
  root: 'forecast-calendar',
  nav: 'calendar-nav',
  title: 'calendar-title',
  summary: 'calendar-summary',
  stat: 'calendar-stat',
  statWarning: 'calendar-stat--warning',
  statLabel: 'calendar-stat__label',
  statValue: 'calendar-stat__value',
  grid: 'calendar-grid',
  header: 'calendar-header',
  headerCell: 'calendar-header-cell',
  body: 'calendar-body',
  day: 'calendar-day',
  dayEmpty: 'calendar-day--empty',
  dayToday: 'calendar-day--today',
  dayLowBalance: 'calendar-day--low-balance',
  dayHasEvents: 'calendar-day--has-events',
  dayHeader: 'calendar-day__header',
  dayNumber: 'calendar-day__number',
  dayWarning: 'calendar-day__warning',
  dayBalance: 'calendar-day__balance',
  dayEvents: 'calendar-day__events',
  event: 'calendar-event',
  eventMore: 'calendar-event--more',
  textDanger: 'text-danger',
  legend: 'calendar-legend',
  legendItem: 'legend-item',
  legendDot: 'legend-dot',
} as const;

// ==================== UTILS ====================

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/**
 * Formats year, month, day into YYYY-MM-DD
 */
function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Returns localized month names (January, February...)
 */
function getLocalizedMonths(locale: string = 'default'): string[] {
  const format = new Intl.DateTimeFormat(locale, { month: 'long' });
  // Generate date objects for each month of a known year (e.g., 2000)
  return Array.from({ length: 12 }, (_, i) => format.format(new Date(2000, i, 1)));
}

/**
 * Returns localized weekday headers (Sun, Mon...) starting from Sunday.
 */
function getLocalizedWeekdays(locale: string = 'default'): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  // January 2, 2000 was a Sunday. Use it as an anchor.
  const sunday = new Date(2000, 0, 2);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + i);
    return format.format(day);
  });
}

/**
 * Groups recurring items or bills by their due day for O(1) lookup.
 */
function groupEventsByDay<T extends { due_day: number }>(items: T[], type: CalendarEvent['type']): Map<number, CalendarEvent[]> {
  const map = new Map<number, CalendarEvent[]>();
  for (const item of items) {
    if (!map.has(item.due_day)) {
      map.set(item.due_day, []);
    }
    // We assume 'name' and 'amount' exist on both item types based on usage
    map.get(item.due_day)!.push({
      type,
      name: (item as any).name, // Type assertion safe due to known input structure
      amount: (item as any).amount,
    });
  }
  return map;
}

/**
 * escapes HTML special characters to prevent XSS.
 */
function escapeHtml(unsafe: string | number): string {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==================== CORE LOGIC ====================

function generateCalendarDays(props: ForecastCalendarProps): CalendarDay[] {
  const { month, year, timeline, bills, recurringCharges, lowBalanceThreshold } = props;

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date().toISOString().split('T')[0];

  // Optimization: Pre-calculate events per day to avoid nested loops
  const billsByDay = groupEventsByDay(bills, 'bill');
  const recurringByDay = groupEventsByDay(recurringCharges, 'recurring');

  // Fix: Explicitly sort timeline to ensure deterministic "last known balance" logic
  // This prevents issues if the API returns unsorted data.
  const sortedTimeline = [...timeline].sort((a, b) => a.date.localeCompare(b.date));

  // Create balance lookup map
  const balanceMap = new Map<string, number>();
  for (const entry of sortedTimeline) {
    balanceMap.set(entry.date, entry.balance);
  }

  // Get last known balance for fill-forward (using the chronologically last entry)
  // Logic: If a day is missing in the timeline (e.g., future days beyond projection),
  // we assume the balance remains at the last known value.
  let lastBalance = 0;
  if (sortedTimeline.length > 0) {
    lastBalance = sortedTimeline[sortedTimeline.length - 1]?.balance ?? 0;
  }

  const days: CalendarDay[] = [];

  // 1. Add padding cells (days before the 1st of the month)
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

  // 2. Add actual days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = toISODate(year, month, day);
    const balance = balanceMap.get(dateStr) ?? lastBalance;

    // Gather events
    const events: CalendarEvent[] = [
      ...(billsByDay.get(day) || []),
      ...(recurringByDay.get(day) || []),
    ];

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

function renderDayCell(day: CalendarDay, formatCurrency: (n: number) => string): string {
  if (!day.isCurrentMonth) {
    return `<div class="${CSS_CLASSES.day} ${CSS_CLASSES.dayEmpty}"></div>`;
  }

  const classes = [
    CSS_CLASSES.day,
    day.isToday ? CSS_CLASSES.dayToday : '',
    day.isLowBalance ? CSS_CLASSES.dayLowBalance : '',
    day.events.length > 0 ? CSS_CLASSES.dayHasEvents : '',
  ].filter(Boolean).join(' ');

  const eventsHtml = day.events.slice(0, 2).map(e => `
        <div class="${CSS_CLASSES.event} ${CSS_CLASSES.event}--${e.type}" title="${escapeHtml(e.name)}: ${escapeHtml(formatCurrency(e.amount))}">
          ${escapeHtml(e.name.substring(0, 12))}${e.name.length > 12 ? '...' : ''}
        </div>
    `).join('');

  const moreEvents = day.events.length > 2
    ? `<div class="${CSS_CLASSES.event} ${CSS_CLASSES.eventMore}">+${day.events.length - 2} more</div>`
    : '';

  return `
        <div class="${classes}" data-date="${escapeHtml(day.date)}">
          <div class="${CSS_CLASSES.dayHeader}">
            <span class="${CSS_CLASSES.dayNumber}">${day.dayOfMonth}</span>
            ${day.isLowBalance ? '<i data-lucide="alert-triangle" class="' + CSS_CLASSES.dayWarning + '"></i>' : ''}
          </div>
          <div class="${CSS_CLASSES.dayBalance} ${day.projectedBalance < 0 ? CSS_CLASSES.textDanger : ''}">
            ${escapeHtml(formatCurrency(day.projectedBalance))}
          </div>
          <div class="${CSS_CLASSES.dayEvents}">
            ${eventsHtml}
            ${moreEvents}
          </div>
        </div>
    `;
}

export const ForecastCalendar = (props: ForecastCalendarProps): string => {
  const {
    month,
    year,
    formatCurrency,
    bills,
    recurringCharges,
    onPrevMonth,
    onNextMonth,
    locale = 'default'
  } = props;

  const days = generateCalendarDays(props);
  const monthNames = getLocalizedMonths(locale);
  const dayHeaders = getLocalizedWeekdays(locale);

  const dayHeadersHtml = dayHeaders
    .map(d => `<div class="${CSS_CLASSES.headerCell}">${d}</div>`)
    .join('');

  const dayCellsHtml = days.map(d => renderDayCell(d, formatCurrency)).join('');

  const totalBills = bills.reduce((sum, b) => sum + b.amount, 0);
  const totalRecurring = recurringCharges.reduce((sum, r) => sum + r.amount, 0);
  const lowBalanceDays = days.filter(d => d.isLowBalance).length;

  return `
    <div class="${CSS_CLASSES.root}">
      <div class="${CSS_CLASSES.nav}">
        <button class="btn-icon" onclick="${escapeHtml(onPrevMonth || '')}" ${!onPrevMonth ? 'disabled' : ''}>
          <i data-lucide="chevron-left"></i>
        </button>
        <h3 class="${CSS_CLASSES.title}">${monthNames[month]} ${year}</h3>
        <button class="btn-icon" onclick="${escapeHtml(onNextMonth || '')}" ${!onNextMonth ? 'disabled' : ''}>
          <i data-lucide="chevron-right"></i>
        </button>
      </div>
      
      <div class="${CSS_CLASSES.summary}">
        <div class="${CSS_CLASSES.stat}">
          <span class="${CSS_CLASSES.statLabel}">Bills Due</span>
          <span class="${CSS_CLASSES.statValue}">${escapeHtml(formatCurrency(totalBills))}</span>
        </div>
        <div class="${CSS_CLASSES.stat}">
          <span class="${CSS_CLASSES.statLabel}">Subscriptions</span>
          <span class="${CSS_CLASSES.statValue}">${escapeHtml(formatCurrency(totalRecurring))}</span>
        </div>
        ${lowBalanceDays > 0 ? `
          <div class="${CSS_CLASSES.stat} ${CSS_CLASSES.statWarning}">
            <span class="${CSS_CLASSES.statLabel}">Low Balance Days</span>
            <span class="${CSS_CLASSES.statValue}">${lowBalanceDays}</span>
          </div>
        ` : ''}
      </div>

      <div class="${CSS_CLASSES.grid}">
        <div class="${CSS_CLASSES.header}">
          ${dayHeadersHtml}
        </div>
        <div class="${CSS_CLASSES.body}">
          ${dayCellsHtml}
        </div>
      </div>
      
      <div class="${CSS_CLASSES.legend}">
        <div class="${CSS_CLASSES.legendItem}"><span class="${CSS_CLASSES.legendDot} ${CSS_CLASSES.legendDot}--bill"></span> Bill Due</div>
        <div class="${CSS_CLASSES.legendItem}"><span class="${CSS_CLASSES.legendDot} ${CSS_CLASSES.legendDot}--recurring"></span> Subscription</div>
        <div class="${CSS_CLASSES.legendItem}"><span class="${CSS_CLASSES.legendDot} ${CSS_CLASSES.legendDot}--low"></span> Low Balance Warning</div>
      </div>
    </div>
  `;
};