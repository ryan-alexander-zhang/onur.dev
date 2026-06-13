import {
  LuBookmark as BookmarkIcon,
  LuNavigation as NavigationIcon,
  LuPencilLine as PencilLineIcon,
  LuSparkles as SparklesIcon,
  LuWandSparkles as WandSparklesIcon
} from 'react-icons/lu'

export const TWEETS_COLLECTION_ID = 15896982

export const LINKS = [
  {
    href: '/',
    label: 'Home',
    icon: <SparklesIcon size={16} />
  },
  {
    href: '/writing',
    label: 'Writing',
    icon: <PencilLineIcon size={16} />
  },
  {
    href: '/journey',
    label: 'Journey',
    icon: <NavigationIcon size={16} />
  },
  {
    href: '/stack',
    label: 'Stack',
    icon: <WandSparklesIcon size={16} />
  },
  {
    href: '/bookmarks',
    label: 'Bookmarks',
    icon: <BookmarkIcon size={16} />
  }
]

export const SCROLL_AREA_ID = 'scroll-area'
export const MOBILE_SCROLL_THRESHOLD = 20
export const SUPABASE_TABLE_NAME = 'pages'

export const SUBMIT_BOOKMARK_FORM_TITLE = 'Submit a bookmark'
export const SUBMIT_BOOKMARK_FORM_DESCRIPTION =
  "Send me a website you like and if I like it too, you'll see it in the bookmarks list. With respect, please do not submit more than 5 websites a day."

export const CONTENT_TYPES = {
  PAGE: 'page',
  POST: 'post',
  LOGBOOK: 'logbook'
}
