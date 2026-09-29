/* ================================================================
   CATEGORY TABS & COMPETITIONS FILTERS
   ================================================================ */

function buildCategoryTabs() {
  const container = document.getElementById('category-tabs');
  if (!container) return;

  const counts = { all: allMatches.length };
  CATEGORIES.forEach(cat => {
    if (cat.id !== 'all') {
      counts[cat.id] = allMatches.filter(m => getCompetitionCategory(m.competition, m.competition_country) === cat.id).length;
    }
  });

  container.innerHTML = CATEGORIES.map(cat => {
    const count = counts[cat.id] || 0;
    const isActive = activeCategory === cat.id;
    return `
      <button class="category-tab ${isActive ? 'active' : ''}" 
              data-category="${cat.id}" 
              onclick="handleCategoryClick(this)">
        <span class="category-icon">${cat.icon}</span>
        <span class="category-name">${cat.label}</span>
        <span class="category-count">${count}</span>
      </button>
    `;
  }).join('');
}

function handleCategoryClick(btn) {
  const catId = btn.getAttribute('data-category');
  setCategory(catId);
}

function setCategory(categoryId) {
  activeCategory = categoryId;
  activeCompetition = 'all'; // reset sub-filter
  buildCategoryTabs();
  buildCompetitionFilters();
  renderMatches();
}

function buildCompetitionFilters() {
  const container = document.getElementById('competition-filters');
  if (!container) return;

  const matchesInCategory = activeCategory === 'all'
    ? allMatches
    : allMatches.filter(m => getCompetitionCategory(m.competition, m.competition_country) === activeCategory);

  const competitions = [...new Set(matchesInCategory.map(m => m.competition))].sort();

  let html = `
    <button class="filter-chip ${activeCompetition === 'all' ? 'active' : ''}" 
            data-filter="all" onclick="handleCompetitionClick(this)">
      Toutes (${matchesInCategory.length})
    </button>
  `;

  competitions.forEach(c => {
    const count = matchesInCategory.filter(m => m.competition === c).length;
    html += `
      <button class="filter-chip ${activeCompetition === c ? 'active' : ''}" 
              data-filter="${escapeHtml(c)}" onclick="handleCompetitionClick(this)">
        ${escapeHtml(c)} (${count})
      </button>
    `;
  });

  container.innerHTML = html;
}

function handleCompetitionClick(btn) {
  const filter = btn.getAttribute('data-filter');
  setCompetitionFilter(filter);
}

function setCompetitionFilter(competition) {
  activeCompetition = competition;
  document.querySelectorAll('#competition-filters .filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === competition);
  });
  renderMatches();
}

function setSorting(value) {
  sortBy = value;
  renderMatches();
}

function setSearch(value) {
  searchQuery = value;
  renderMatches();
}
