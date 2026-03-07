"use client";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import {
  BoxCubeIcon,
  ChevronDownIcon,
  DollarLineIcon,
  GridIcon,
  HorizontaLDots,
  LockIcon,
  PageIcon,
  PieChartIcon,
  UserCircleIcon,
} from "../icons/index";

type SubItem = {
  name: string;
  path: string;
  permission?: string;
};

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  permission?: string;
  subItems?: SubItem[];
};

type MenuCategory = "main" | "reports" | "activities";

const mainItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/",
    permission: "dashboard.view",
  },
  {
    icon: <UserCircleIcon />,
    name: "Members",
    path: "/members",
    permission: "members.view",
  },
  {
    icon: <DollarLineIcon />,
    name: "Payment Page",
    path: "/pay",
    permission: "dashboard.view",
  },
];

const reportsItems: NavItem[] = [
  {
    icon: <PageIcon />,
    name: "Members Report",
    path: "/reports/members",
    permission: "reports.view",
  },
];

const activitiesItems: NavItem[] = [
  {
    icon: <UserCircleIcon />,
    name: "Users",
    path: "/users",
    permission: "users.view",
  },
  {
    icon: <LockIcon />,
    name: "Roles",
    path: "/roles",
    permission: "roles.view",
  },
  {
    icon: <LockIcon />,
    name: "Permissions",
    path: "/permissions",
    permission: "permissions.view",
  },
];

function filterByPermission<T extends { permission?: string; subItems?: SubItem[] }>(
  items: T[],
  hasPermission: (p: string) => boolean
): T[] {
  return items
    .filter((item) => !item.permission || hasPermission(item.permission))
    .map((item) => {
      if (!item.subItems) return item;
      const filteredSub = item.subItems.filter(
        (s) => !s.permission || hasPermission(s.permission)
      );
      return { ...item, subItems: filteredSub.length ? filteredSub : undefined };
    })
    .filter((item) => !item.subItems || (item.subItems && item.subItems.length > 0));
}

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { hasPermission } = useAuth();
  const pathname = usePathname();

  const mainNav = useMemo(() => filterByPermission(mainItems, hasPermission), [hasPermission]);
  const reportsNav = useMemo(() => filterByPermission(reportsItems, hasPermission), [hasPermission]);
  const activitiesNav = useMemo(() => filterByPermission(activitiesItems, hasPermission), [hasPermission]);

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: MenuCategory;
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  const handleSubmenuToggle = (index: number, menuType: MenuCategory) => {
    setOpenSubmenu((prev) => {
      if (prev?.type === menuType && prev?.index === index) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  useEffect(() => {
    let submenuMatched = false;
    let matchedState: { type: MenuCategory; index: number } | null = null;
    const categories: MenuCategory[] = ["main", "reports", "activities"];

    categories.forEach((menuType) => {
      const items =
        menuType === "main" ? mainNav :
        menuType === "reports" ? reportsNav : activitiesNav;

      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (subItem.path === pathname) {
              matchedState = { type: menuType, index };
              submenuMatched = true;
            }
          });
        }
      });
    });

    setOpenSubmenu((prev) => {
      if (submenuMatched && matchedState) {
        if (prev?.type === matchedState.type && prev?.index === matchedState.index) return prev;
        return matchedState;
      }
      if (!submenuMatched && prev === null) return prev;
      return null;
    });
  }, [pathname, mainNav, reportsNav, activitiesNav]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      const measure = () => {
        const el = subMenuRefs.current[key];
        if (el?.scrollHeight) {
          setSubMenuHeight((prev) => ({ ...prev, [key]: el.scrollHeight }));
        }
      };
      measure();
      requestAnimationFrame(measure);
    }
  }, [openSubmenu]);

  const renderMenuItems = (items: NavItem[], menuType: MenuCategory) => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <>
              <button
                onClick={() => handleSubmenuToggle(index, menuType)}
                className={`menu-item group ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-active"
                    : "menu-item-inactive"
                } cursor-pointer ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"
                }`}
              >
                <span
                  className={`${
                    openSubmenu?.type === menuType && openSubmenu?.index === index
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <>
                    <span className="menu-item-text">{nav.name}</span>
                    <ChevronDownIcon
                      className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                        openSubmenu?.type === menuType && openSubmenu?.index === index
                          ? "rotate-180 text-brand-500"
                          : ""
                      }`}
                    />
                  </>
                )}
              </button>

              <div
                ref={(el) => {
                  subMenuRefs.current[`${menuType}-${index}`] = el;
                }}
                className="overflow-hidden transition-all duration-300"
                style={{
                  height:
                    openSubmenu?.type === menuType && openSubmenu?.index === index
                      ? (subMenuHeight[`${menuType}-${index}`] != null ? `${subMenuHeight[`${menuType}-${index}`]}px` : "auto")
                      : "0px",
                }}
              >
                <ul className="mt-2 space-y-1 ml-9">
                  {nav.subItems.map((subItem) => (
                    <li key={subItem.name}>
                      <Link
                        href={subItem.path}
                        className={`menu-dropdown-item ${
                          isActive(subItem.path)
                            ? "menu-dropdown-item-active"
                            : "menu-dropdown-item-inactive"
                        }`}
                      >
                        {subItem.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`${
                    isActive(nav.path) ? "menu-item-icon-active" : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">{nav.name}</span>
                )}
              </Link>
            )
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <aside
      className={`no-print fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${isExpanded || isMobileOpen || isHovered ? "w-[290px]" : "w-[90px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`py-8 flex ${!isExpanded && !isHovered && !isMobileOpen ? "lg:justify-center" : ""}`}>
        <Link href="/" className={`flex items-center gap-2 ${!isExpanded && !isHovered && !isMobileOpen ? "lg:justify-center" : ""}`}>
          <Image
            src="/logo/EF3CA930-92BD-4A4E-8E72-BC823679B82A.webp"
            alt="Somali Dreams"
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 object-contain"
          />
          {(isExpanded || isHovered || isMobileOpen) && (
            <span className="text-sm font-semibold text-gray-800 dark:text-white/90 whitespace-nowrap">
              Somali Dreams
            </span>
          )}
        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            {mainNav.length > 0 && (
              <div>
                <h2 className={`mb-4 text-xs uppercase flex text-gray-400 ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
                  {isExpanded || isHovered || isMobileOpen ? "Main" : <HorizontaLDots />}
                </h2>
                {renderMenuItems(mainNav, "main")}
              </div>
            )}

            {reportsNav.length > 0 && (
              <div>
                <h2 className={`mb-4 text-xs uppercase flex text-gray-400 ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
                  {isExpanded || isHovered || isMobileOpen ? "Reports" : <HorizontaLDots />}
                </h2>
                {renderMenuItems(reportsNav, "reports")}
              </div>
            )}

            {activitiesNav.length > 0 && (
              <div>
                <h2 className={`mb-4 text-xs uppercase flex text-gray-400 ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
                  {isExpanded || isHovered || isMobileOpen ? "Settings" : <HorizontaLDots />}
                </h2>
                {renderMenuItems(activitiesNav, "activities")}
              </div>
            )}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
