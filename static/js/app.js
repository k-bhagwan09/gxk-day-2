document.addEventListener('DOMContentLoaded', () => {
    // State management
    let releases = []; // holds all parsed release items
    const selectedIds = new Set(); // holds active selected item IDs
    let activeFilters = {
        search: '',
        type: 'all',
        sort: 'newest'
    };

    // Theme Toggle State Init
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeCheckbox = document.getElementById('theme-checkbox');
    if (themeCheckbox) {
        themeCheckbox.checked = (savedTheme === 'light');
    }

    // DOM Elements
    const btnRefresh = document.getElementById('btn-refresh');
    const cacheIndicator = document.getElementById('cache-indicator');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const typeFilter = document.getElementById('type-filter');
    const sortFilter = document.getElementById('sort-filter');
    const statsSummary = document.getElementById('stats-summary');
    const selectionHeaderActions = document.getElementById('selection-header-actions');
    const btnSelectAll = document.getElementById('btn-select-all');
    const btnClearAll = document.getElementById('btn-clear-all');

    const loadingContainer = document.getElementById('loading-container');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    const btnRetry = document.getElementById('btn-retry');
    const emptyContainer = document.getElementById('empty-container');
    const btnResetFilters = document.getElementById('btn-reset-filters');
    const cardsContainer = document.getElementById('cards-container');

    const floatingBar = document.getElementById('floating-bar');
    const selectionCount = document.getElementById('selection-count');
    const btnTweetSelected = document.getElementById('btn-tweet-selected');
    const btnClearSelection = document.getElementById('btn-clear-selection');

    // Utility actions
    const btnExport = document.getElementById('btn-export');

    // Modal DOM Elements
    const tweetModal = document.getElementById('tweet-modal');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCancelTweet = document.getElementById('btn-cancel-tweet');
    const btnPublishTweet = document.getElementById('btn-publish-tweet');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCounter = document.getElementById('char-counter');

    // Emojis mapping for different categories
    const categoryEmojis = {
        'Feature': '🚀',
        'Changed': '🔄',
        'Deprecated': '⚠️',
        'Fix': '🔧',
        'Resolved': '✅',
        'Issue': '🐛',
        'Announcement': '📢',
        'Update': '📝'
    };

    // Initialize application
    fetchReleases();

    // ==========================================================================
    // EVENT LISTENERS
    // ==========================================================================

    // Theme toggle handler
    if (themeCheckbox) {
        themeCheckbox.addEventListener('change', () => {
            const nextTheme = themeCheckbox.checked ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('theme', nextTheme);
        });
    }

    // CSV export handler
    btnExport.addEventListener('click', () => {
        // If there are selected items, export those. Otherwise, export currently filtered items.
        const itemsToExport = selectedIds.size > 0 
            ? releases.filter(item => selectedIds.has(item.id)) 
            : getFilteredItems();
            
        if (itemsToExport.length === 0) {
            alert('No release notes matches to export.');
            return;
        }
        
        exportToCSV(itemsToExport);
    });

    // Refresh controls
    btnRefresh.addEventListener('click', () => fetchReleases(true));
    btnRetry.addEventListener('click', () => fetchReleases(true));

    // Search filter
    searchInput.addEventListener('input', (e) => {
        activeFilters.search = e.target.value.trim();
        toggleClearSearchButton();
        renderFilteredReleases();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        activeFilters.search = '';
        toggleClearSearchButton();
        renderFilteredReleases();
        searchInput.focus();
    });

    // Dropdown filters
    typeFilter.addEventListener('change', (e) => {
        activeFilters.type = e.target.value;
        renderFilteredReleases();
    });

    sortFilter.addEventListener('change', (e) => {
        activeFilters.sort = e.target.value;
        renderFilteredReleases();
    });

    btnResetFilters.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        typeFilter.value = 'all';
        sortFilter.value = 'newest';
        activeFilters = { search: '', type: 'all', sort: 'newest' };
        renderFilteredReleases();
    });

    // Select/Deselect All Actions
    btnSelectAll.addEventListener('click', () => {
        const visibleCards = getFilteredItems();
        visibleCards.forEach(item => selectedIds.add(item.id));
        updateSelectionUI();
    });

    btnClearAll.addEventListener('click', () => {
        selectedIds.clear();
        updateSelectionUI();
    });

    btnClearSelection.addEventListener('click', () => {
        selectedIds.clear();
        updateSelectionUI();
    });

    // Modal Events
    modalBackdrop.addEventListener('click', closeModal);
    btnCloseModal.addEventListener('click', closeModal);
    btnCancelTweet.addEventListener('click', closeModal);
    tweetTextarea.addEventListener('input', updateCharCount);
    btnPublishTweet.addEventListener('click', publishTweet);

    // Floating Tweet Button
    btnTweetSelected.addEventListener('click', () => {
        const selectedItems = releases.filter(item => selectedIds.has(item.id));
        if (selectedItems.length > 0) {
            openTweetModal(selectedItems);
        }
    });

    // ==========================================================================
    // CORE FUNCTIONS & API FETCH
    // ==========================================================================

    function toggleClearSearchButton() {
        if (searchInput.value.length > 0) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
    }

    async function fetchReleases(forceRefresh = false) {
        showLoadingState();
        try {
            const url = forceRefresh ? '/api/releases?refresh=true' : '/api/releases';
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.success) {
                releases = data.items;
                
                // Show cache indicator if applicable
                if (data.from_cache) {
                    cacheIndicator.classList.remove('hidden');
                } else {
                    cacheIndicator.classList.add('hidden');
                }
                
                // Reset selection if it contains items no longer present
                selectedIds.clear();
                
                renderFilteredReleases();
            } else {
                throw new Error(data.error || 'Unknown error occurred while parsing');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            showErrorState(error.message);
        }
    }

    // ==========================================================================
    // FILTER & SORT LOGIC
    // ==========================================================================

    function getFilteredItems() {
        return releases.filter(item => {
            // Type Filter
            if (activeFilters.type !== 'all' && item.type !== activeFilters.type) {
                return false;
            }
            
            // Search Query
            if (activeFilters.search) {
                const query = activeFilters.search.toLowerCase();
                const matchesType = item.type.toLowerCase().includes(query);
                const matchesDate = item.formatted_date.toLowerCase().includes(query);
                const matchesContent = item.text_content.toLowerCase().includes(query);
                return matchesType || matchesDate || matchesContent;
            }
            
            return true;
        }).sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            
            if (activeFilters.sort === 'newest') {
                return dateB - dateA;
            } else {
                return dateA - dateB;
            }
        });
    }

    function renderFilteredReleases() {
        const filteredItems = getFilteredItems();
        
        // Update stats
        if (releases.length === 0) {
            statsSummary.textContent = 'No release notes loaded.';
            selectionHeaderActions.classList.add('hidden');
        } else {
            statsSummary.textContent = `Showing ${filteredItems.length} of ${releases.length} updates`;
            if (filteredItems.length > 0) {
                selectionHeaderActions.classList.remove('hidden');
            } else {
                selectionHeaderActions.classList.add('hidden');
            }
        }

        // Show empty container if zero items
        if (filteredItems.length === 0) {
            if (releases.length > 0) {
                showEmptyState();
            }
            return;
        }

        // Show grid container
        loadingContainer.classList.add('hidden');
        errorContainer.classList.add('hidden');
        emptyContainer.classList.add('hidden');
        cardsContainer.classList.remove('hidden');

        // Clear existing cards
        cardsContainer.innerHTML = '';

        // Inject new cards
        filteredItems.forEach(item => {
            const card = createCardElement(item);
            cardsContainer.appendChild(card);
        });

        // Make sure selections are synced visually
        updateSelectionUI();
    }

    // ==========================================================================
    // UI ELEMENT CREATION
    // ==========================================================================

    function createCardElement(item) {
        const card = document.createElement('article');
        card.className = 'card release-card';
        card.setAttribute('data-id', item.id);
        
        const emoji = categoryEmojis[item.type] || '📝';
        const typeClass = `type-${item.type.toLowerCase()}`;
        
        card.innerHTML = `
            <div class="card-selector" title="Select for tweeting">
                <svg viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
            <header class="card-header-meta">
                <span class="date-pill">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <span>${item.formatted_date}</span>
                </span>
                <span class="type-badge ${typeClass}">${emoji} ${item.type}</span>
            </header>
            
            <div class="card-body">
                ${item.html}
            </div>
            
            <footer class="card-footer">
                <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="btn-card-action" title="View official release notes" onclick="event.stopPropagation();">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                </a>
                <button class="btn-card-action btn-card-copy" title="Copy update text to clipboard" onclick="event.stopPropagation();">
                    <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <svg class="check-icon hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: #10b981;">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </button>
                <button class="btn-card-action btn-card-tweet" title="Tweet about this update" onclick="event.stopPropagation();">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                </button>
            </footer>
        `;

        // Card Selection Event
        card.addEventListener('click', (e) => {
            // If the user clicked interactive actions inside the card, don't trigger card selection
            if (e.target.tagName === 'A' || e.target.closest('a') || e.target.closest('button')) {
                return;
            }
            toggleSelection(item.id);
        });

        // Copy plain text to clipboard
        const cardCopyBtn = card.querySelector('.btn-card-copy');
        cardCopyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const copyIcon = cardCopyBtn.querySelector('.copy-icon');
            const checkIcon = cardCopyBtn.querySelector('.check-icon');
            
            navigator.clipboard.writeText(item.text_content).then(() => {
                cardCopyBtn.classList.add('copied');
                copyIcon.classList.add('hidden');
                checkIcon.classList.remove('hidden');
                
                setTimeout(() => {
                    cardCopyBtn.classList.remove('copied');
                    copyIcon.classList.remove('hidden');
                    checkIcon.classList.add('hidden');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        });

        // Single Tweet Button inside card
        const cardTweetBtn = card.querySelector('.btn-card-tweet');
        cardTweetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTweetModal([item]);
        });

        return card;
    }

    // ==========================================================================
    // UI STATES (LOADING, ERROR, EMPTY)
    // ==========================================================================

    function showLoadingState() {
        // Spin the refresh icon
        btnRefresh.disabled = true;
        const icon = btnRefresh.querySelector('.spinner-icon');
        if (icon) icon.classList.add('spinner-active');

        loadingContainer.classList.remove('hidden');
        errorContainer.classList.add('hidden');
        emptyContainer.classList.add('hidden');
        cardsContainer.classList.add('hidden');
        selectionHeaderActions.classList.add('hidden');
    }

    function showErrorState(message) {
        btnRefresh.disabled = false;
        const icon = btnRefresh.querySelector('.spinner-icon');
        if (icon) icon.classList.remove('spinner-active');

        loadingContainer.classList.add('hidden');
        errorContainer.classList.remove('hidden');
        emptyContainer.classList.add('hidden');
        cardsContainer.classList.add('hidden');
        selectionHeaderActions.classList.add('hidden');
        
        errorMessage.textContent = message || 'Unknown error occurred.';
    }

    function showEmptyState() {
        btnRefresh.disabled = false;
        const icon = btnRefresh.querySelector('.spinner-icon');
        if (icon) icon.classList.remove('spinner-active');

        loadingContainer.classList.add('hidden');
        errorContainer.classList.add('hidden');
        emptyContainer.classList.remove('hidden');
        cardsContainer.classList.add('hidden');
        selectionHeaderActions.classList.add('hidden');
    }

    // ==========================================================================
    // SELECTION STATE MANAGEMENT
    // ==========================================================================

    function toggleSelection(id) {
        if (selectedIds.has(id)) {
            selectedIds.delete(id);
        } else {
            selectedIds.add(id);
        }
        updateSelectionUI();
    }

    function updateSelectionUI() {
        // Toggle selected class on all visible cards
        const cards = cardsContainer.querySelectorAll('.release-card');
        cards.forEach(card => {
            const cardId = card.getAttribute('data-id');
            if (selectedIds.has(cardId)) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        // Floating action bar logic
        const count = selectedIds.size;
        if (count > 0) {
            selectionCount.textContent = count;
            floatingBar.classList.add('active');
            floatingBar.classList.remove('hidden');
        } else {
            floatingBar.classList.remove('active');
            // Timeout to allow slide-down animation to finish
            setTimeout(() => {
                if (selectedIds.size === 0) {
                    floatingBar.classList.add('hidden');
                }
            }, 300);
        }
    }

    // ==========================================================================
    // EXPORT TO CSV LOGIC
    // ==========================================================================

    function exportToCSV(items) {
        // Headers
        const headers = ['ID', 'Date', 'Type', 'Description', 'Link'];
        
        // Escape helper for CSV cells (UTF-8 safe)
        const escapeCSV = (text) => {
            if (text === null || text === undefined) return '';
            let stringVal = String(text).trim();
            // Double up double quotes
            stringVal = stringVal.replace(/"/g, '""');
            // Wrap in double quotes if it contains separator character, quotes, or newlines
            if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n') || stringVal.includes('\r')) {
                return `"${stringVal}"`;
            }
            return stringVal;
        };
        
        const rows = [
            headers.join(','),
            ...items.map(item => [
                escapeCSV(item.id),
                escapeCSV(item.formatted_date),
                escapeCSV(item.type),
                escapeCSV(item.text_content),
                escapeCSV(item.link)
            ].join(','))
        ];
        
        // Prepend UTF-8 BOM so Excel opens emojis/unicode characters correctly
        const csvContent = "\uFEFF" + rows.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `bigquery_release_notes_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ==========================================================================
    // TWITTER INTEGRATION & PREVIEW MODAL
    // ==========================================================================

    function openTweetModal(items) {
        let text = '';
        
        if (items.length === 1) {
            const item = items[0];
            const emoji = categoryEmojis[item.type] || '📝';
            // Calculate a safe truncation length for the description to fit Twitter's limit
            const header = `${emoji} BigQuery ${item.type} (${item.formatted_date}):\n`;
            const footer = `\n\nRead more: ${item.link}\n#BigQuery #GoogleCloud`;
            
            // Limit text size: 280 - header length - footer length - safe padding
            const maxDescLength = 280 - header.length - footer.length - 5;
            
            let description = item.text_content;
            if (description.length > maxDescLength) {
                description = description.substring(0, maxDescLength - 3) + '...';
            }
            
            text = `${header}${description}${footer}`;
        } else {
            // Sort items by date (newest first)
            const sortedItems = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
            
            let header = `📢 Latest BigQuery Updates:\n`;
            const footer = `\nRead details: https://docs.cloud.google.com/bigquery/docs/release-notes\n#BigQuery #GoogleCloud`;
            
            // Available space for body list
            let maxBodyLength = 280 - header.length - footer.length - 10;
            let body = '';
            
            sortedItems.forEach((item, idx) => {
                const emoji = categoryEmojis[item.type] || '📝';
                // Simplify description
                let desc = item.text_content.replace(/\s+/g, ' ');
                // Pull first sentence or up to 60 characters
                const sentenceEnd = desc.indexOf('.');
                if (sentenceEnd > 10 && sentenceEnd < 70) {
                    desc = desc.substring(0, sentenceEnd + 1);
                } else {
                    desc = desc.substring(0, 50) + '...';
                }
                
                const bullet = `- [${item.formatted_date.split(',')[0]}] ${emoji} ${item.type}: ${desc}\n`;
                if (body.length + bullet.length < maxBodyLength) {
                    body += bullet;
                }
            });
            
            text = `${header}${body}${footer}`;
        }

        // Populate and open modal
        tweetTextarea.value = text;
        updateCharCount();
        tweetModal.classList.remove('hidden');
        tweetTextarea.focus();
    }

    function closeModal() {
        tweetModal.classList.add('hidden');
    }

    function updateCharCount() {
        const count = tweetTextarea.value.length;
        charCounter.textContent = `${count} / 280`;
        
        // Remove old warnings
        charCounter.className = 'char-counter';
        btnPublishTweet.disabled = false;
        
        if (count > 280) {
            charCounter.classList.add('danger');
            btnPublishTweet.disabled = true;
        } else if (count > 250) {
            charCounter.classList.add('warning');
        }
    }

    function publishTweet() {
        const text = tweetTextarea.value;
        if (text.length > 280) return;
        
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
        closeModal();
    }
});
