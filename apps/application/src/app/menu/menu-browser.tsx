"use client";

import { ScrollFade } from "@animate-ui/react/primitives/effects/scroll-fade";
import { Button, Card, SearchField, Skeleton, Spinner } from "@heroui/react";
import { Icon } from "@repo/icons";
import { PageTransition } from "../components/page-transition";
import { MenuCard } from "./menu-card";
import { BackLink } from "../components/back-link";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useState } from "react";
import { menu } from "./[id]/catalog";
import { defaults, groups, offers, toggle, type Group } from "./menu-filters";

type Screen = "list" | "search" | "results" | "filters";
const recentKeys = ["italian", "burger", "salad", "vegetarian", "dessert", "pancakes"] as const;
const groupKeys = Object.keys(groups) as Group[];

export function MenuBrowser({ openSearch, recommended, initialQuery, promo, category }: { openSearch: boolean; recommended: boolean; initialQuery: string; promo: boolean; category: string }) {
  const t = useTranslations("Application.browse");
  const dish = useTranslations("Application.menu");
  const [screen, setScreen] = useState<Screen>(initialQuery ? "results" : openSearch ? "search" : "list");
  const [query, setQuery] = useState(initialQuery);
  const [typed, setTyped] = useState(initialQuery);
  const [recent, setRecent] = useState<string[]>(recentKeys.map(key => t(key)));
  const loading = screen === "search" && typed.trim() !== query;
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setQuery(typed.trim()), 320);
    return () => clearTimeout(timer);
  }, [typed, loading]);
  const [filters, setFilters] = useState({...defaults, promo, cuisines: category ? [category] : []});
  const [draft, setDraft] = useState(filters);
  const [section, setSection] = useState<Group>("sort");
  const [filterOrigin, setFilterOrigin] = useState<Screen>("list");

  function show(next: Screen) {
    startTransition(() => setScreen(next));
    window.scrollTo(0, 0);
  }
  function search(value: string) {
    const term = value.trim();
    setQuery(term);
    setTyped(term);
    if (term) setRecent(current => [term, ...current.filter(item => item.toLowerCase() !== term.toLowerCase())].slice(0, 6));
    show(term ? "results" : "list");
  }
  function editFilters() {
    setFilterOrigin(screen);
    setDraft(filters);
    setSection("sort");
    show("filters");
  }
  function choose(group: Group, value: string) {
    setDraft(current => ({
      ...current, [group]: group === "cuisines" ? toggle(current[group], value) : value,
    }));
  }
  const entries = menu.filter(item => {
    const offer = offers[item.id]!;
    const tags = [dish(item.key), t("pizza"), t("italian"), ...(offer.vegetarian ? [t("vegetarian")] : [])];
    return tags.some(value => value.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
      && (!filters.promo || offer.promo)
      && filters.cuisines.every(value => offer.cuisines.includes(value));
  }).sort((a, b) => {
    if (filters.sort === "distance") return offers[a.id]!.distance - offers[b.id]!.distance;
    if (filters.sort === "popularity") return b.ratings - a.ratings;
    if (filters.sort === "rating" || recommended) return b.rating - a.rating;
    return 0;
  });

  return <PageTransition effect="slide" pageKey={screen}>
    <main className="browse">
      <header className="browse-header">
        {screen === "list" || (openSearch && screen === "search") ? <BackLink href="/" className="browse-back" aria-label={dish("back")}><Icon name="chevron-left" /></BackLink>
          : <Button isIconOnly size="lg" className="browse-back" aria-label={t("back")} onPress={() => {
            if (screen === "results") { setTyped(query); show("search"); }
            else if (screen === "filters") show(filterOrigin);
            else { setQuery(""); setTyped(""); show("list"); }
          }}><Icon name="chevron-left" /></Button>}
        {screen === "filters" ? <h1>{t("filter")}</h1> : screen === "search" ?
          <SearchField autoFocus className="browse-field" variant="secondary" aria-label={t("search")} value={typed} onChange={setTyped} onSubmit={value => { if (value.trim()) search(value); }}>
            <SearchField.Group><SearchField.SearchIcon /><SearchField.Input placeholder={t("search")} />{loading ? <Spinner size="sm" /> : <SearchField.ClearButton />}</SearchField.Group>
          </SearchField> :
          <Button variant="ghost" className={query ? "browse-term" : "browse-title"} aria-label={t("search")} onPress={() => { setTyped(query); show("search"); }}>
            {query || (recommended ? dish("recommend") : t("pizza"))}
          </Button>}
      </header>
      {screen === "search" && !query && !typed.trim() ? <section className="browse-recent">
        <h2>{t("recent")}</h2>
        <div>{recent.map(value => <Button key={value} onPress={() => search(value)}>{value}</Button>)}</div>
      </section> : screen === "filters" ? <>
        <ScrollFade asChild orientation="horizontal" size={18}><nav className="browse-rail browse-tabs" aria-label={t("filter")}>{groupKeys.map(key =>
          <Button key={key} aria-current={section === key ? "true" : undefined} onPress={() => {
            setSection(key);
            document.getElementById("filter-" + key)?.scrollIntoView({ block: "start" });
          }}>{t(key)}</Button>)}</nav></ScrollFade>
        <div className="browse-groups">{groupKeys.map(group =>
          <Card key={group} id={"filter-" + group} className="browse-group">
            <fieldset><legend>{t(group)}</legend>{groups[group].map(value => {
              const multi = group === "cuisines";
              const selected = multi ? draft[group].includes(value) : draft[group] === value;
              return <label key={value}><input type={multi ? "checkbox" : "radio"} name={group} checked={selected} onChange={() => choose(group, value)} />{t(value)}</label>;
            })}</fieldset>
          </Card>)}</div>
        <footer className="browse-actions"><Button variant="outline" onPress={() => setDraft(defaults)}>{t("reset")}</Button><Button onPress={() => { setFilters(draft); show(filterOrigin); }}>{t("apply")}</Button></footer>
      </> : <>
        <ScrollFade asChild orientation="horizontal" size={18}><nav className="browse-rail browse-tools" aria-label={t("filter")}>
          <Button aria-pressed={filters.cuisines.length > 0} onPress={editFilters}><Icon name="slider-dot-two-horizontal" />{t("filter")}</Button>
          <Button aria-pressed={filters.sort !== defaults.sort} onPress={editFilters}><Icon name="sort-descending" />{t("shortSort")}</Button>
          <Button aria-pressed={filters.promo} onPress={() => setFilters({ ...filters, promo: !filters.promo })}>{t("promo")}</Button>
        </nav></ScrollFade>
        <div className="filter-badges">
          {[
            ...groups.cuisines.filter(value => filters.cuisines.includes(value)).map(value => ({
              label:t(value), remove:() => setFilters(current => ({...current, cuisines:toggle(current.cuisines,value)})),
            })),
            ...groups.sort.filter(value => value !== defaults.sort && filters.sort === value).map(value => ({
              label:t(value), remove:() => setFilters(current => ({...current, sort:defaults.sort})),
            })),
            ...(filters.promo ? [{label:t("promo"), remove:() => setFilters(current => ({...current, promo:false}))}] : []),
          ].map(({label,remove}) => <Button key={label} size="sm" variant="secondary" aria-label={t("removeFilter",{filter:label})} onPress={remove}>{label}<Icon name="close-x" /></Button>)}
        </div>
        <div className="browse-list" aria-busy={loading}>{loading ? [0,1,2].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />) : entries.map(item => <MenuCard key={item.id} item={item} />)}
          {!loading && !entries.length && <div className="list-empty" role="status"><img src="/empty/search.webp" alt="" />{t("noResults")}</div>}
        </div>
      </>}
    </main>
  </PageTransition>;
}
