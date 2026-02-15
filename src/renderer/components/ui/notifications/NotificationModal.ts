/**
 * NotificationModal - Functional component for the global notification modal
 */
export const NotificationModal = (): string => {
  return `
    <div id="notification-modal" class="modal fixed inset-0 bg-black/85 backdrop-blur-sm z-[3000] flex items-center justify-center transition-all duration-300 hidden opacity-0 invisible pointer-events-none">
        <div class="modal-content bg-surface-card w-[90%] max-w-md p-8 rounded-lg border border-border shadow-lg relative animate-[modalSlideUp_0.4s_ease-out]">
            <div class="flex flex-col items-center text-center">
                <div id="notification-icon" class="w-16 h-16 rounded-full flex items-center justify-center mb-6">
                    <!-- Icon injected by Manager -->
                </div>
                <h2 id="notification-title" class="text-2xl font-bold text-text-primary mb-3">Notification</h2>
                <p id="notification-message" class="text-text-muted mb-8 text-lg leading-relaxed"></p>
                
                <div id="notification-custom-content" class="w-full mb-8 empty:hidden"></div>
                
                <div class="flex gap-4 w-full justify-center">
                    <button id="notification-cancel" class="btn secondary px-8 py-3 text-lg hidden">Cancel</button>
                    <button id="notification-confirm" class="btn primary px-8 py-3 text-lg">Confirm</button>
                </div>
            </div>
        </div>
    </div>
    `;
};
