'use client'
// Adapted from timDeHof/shadcn-timeline (MIT), commit 23a910569ca1f44eafd4d069f4ec523d9e2934ab.
// See LICENSE and README.md in this directory.
import { cva } from 'class-variance-authority'
import { motion } from 'framer-motion'
import * as React from 'react'
import { LuCircleAlert as AlertCircle, LuLoaderCircle as Loader2 } from 'react-icons/lu'

import { cn } from '@/lib/utils'

const timelineVariants = cva('relative flex flex-col', {
  variants: {
    size: {
      sm: 'gap-4',
      md: 'gap-6',
      lg: 'gap-8'
    }
  },
  defaultVariants: {
    size: 'md'
  }
})
const Timeline = React.forwardRef(({ className, iconsize, size, children, ...props }, ref) => {
  const items = React.Children.toArray(children)
  if (items.length === 0) {
    return <TimelineEmpty />
  }
  return (
    <ol
      ref={ref}
      aria-label="Timeline"
      className={cn(timelineVariants({ size }), 'relative mx-auto min-h-[600px] w-full max-w-2xl py-8', className)}
      {...props}
    >
      {React.Children.map(children, (child, index) => {
        if (
          React.isValidElement(child) &&
          typeof child.type !== 'string' &&
          'displayName' in child.type &&
          child.type.displayName === 'TimelineItem'
        ) {
          return React.cloneElement(child, {
            iconsize,
            showConnector: index !== items.length - 1
          })
        }
        return child
      })}
    </ol>
  )
})
Timeline.displayName = 'Timeline'
const TimelineItem = React.forwardRef(
  (
    {
      className,
      date,
      compact = false,
      title,
      description,
      children,
      icon,
      iconColor,
      status = 'completed',
      connectorColor,
      showConnector = true,
      iconsize,
      loading,
      error,
      // Omit unused Framer Motion props
      initial,
      animate,
      transition,
      ...props
    },
    ref
  ) => {
    const commonClassName = cn('relative mb-8 w-full last:mb-0', className)
    if (loading) {
      return (
        <motion.li
          ref={ref}
          className={commonClassName}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          role="status"
          {...props}
        >
          <div className="grid grid-cols-[minmax(auto,8rem)_auto_1fr] items-start px-4">
            <div className="pr-4 text-right">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
            </div>

            <div className="mx-3 flex flex-col items-center justify-start gap-y-2">
              <div className="relative flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-gray-100 ring-8 ring-white">
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              </div>
              {showConnector && <div className="h-full w-0.5 animate-pulse bg-gray-100" />}
            </div>

            <div className="flex flex-col gap-2 pl-2">
              <div className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-48 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          </div>
        </motion.li>
      )
    }
    if (error) {
      return (
        <motion.li
          ref={ref}
          className={cn(commonClassName, 'border border-red-500/50 bg-red-500/10')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          role="alert"
          {...props}
        >
          <div className="grid grid-cols-[minmax(auto,8rem)_auto_1fr] items-start px-4">
            <div className="pr-4 text-right">
              <TimelineTime className="text-red-600">{date}</TimelineTime>
            </div>

            <div className="mx-3 flex flex-col items-center justify-start gap-y-2">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 ring-8 ring-white">
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
              {showConnector && <TimelineConnector status="pending" className="h-full" />}
            </div>

            <div className="flex flex-col gap-2 pl-2">
              <TimelineHeader>
                <TimelineTitle className="text-red-600">{title || 'Error'}</TimelineTitle>
              </TimelineHeader>
              <TimelineDescription className="text-red-600">{error}</TimelineDescription>
            </div>
          </div>
        </motion.li>
      )
    }
    const content = (
      <div
        className={cn(
          'grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3',
          !compact && 'sm:grid-cols-[5.5rem_2rem_minmax(0,1fr)]'
        )}
        {...(status === 'in-progress' ? { 'aria-current': 'step' } : {})}
      >
        {/* Date */}
        {!compact && (
          <div className="col-start-2 row-start-1 flex flex-col pt-1 sm:col-start-1">
            <TimelineTime
              date={date}
              format={{ month: 'short', day: '2-digit', year: undefined }}
              className="sm:text-right"
            />
          </div>
        )}
        {/* Timeline dot and connector */}
        <div
          aria-hidden="true"
          className={cn(
            'relative col-start-1 row-start-1 flex h-full flex-col items-center',
            !compact && 'row-span-2 sm:col-start-2 sm:row-span-1'
          )}
        >
          <div className="relative z-10">
            <TimelineIcon icon={icon} color={iconColor} status={status} iconSize={iconsize} />
          </div>
          {showConnector && <div className="absolute top-10 -bottom-8 w-px bg-gray-200" />}
        </div>

        {/* Content */}
        <TimelineContent
          className={cn(
            'col-start-2 min-w-0 p-0',
            compact ? 'row-start-1' : 'row-start-2 sm:col-start-3 sm:row-start-1'
          )}
        >
          {title && (
            <TimelineHeader>
              <TimelineTitle>{title}</TimelineTitle>
            </TimelineHeader>
          )}
          {description && <TimelineDescription>{description}</TimelineDescription>}
          {children}
        </TimelineContent>
      </div>
    )
    const {
      style,
      onDrag,
      onDragStart,
      onDragEnd,
      onAnimationStart,
      onAnimationComplete,
      transformTemplate,
      whileHover,
      whileTap,
      whileDrag,
      whileFocus,
      whileInView,
      ...filteredProps
    } = props
    return (
      <li ref={ref} className={commonClassName} {...filteredProps}>
        {content}
      </li>
    )
  }
)
TimelineItem.displayName = 'TimelineItem'
const defaultDateFormat = {
  year: 'numeric',
  month: 'short',
  day: '2-digit'
}
const TimelineTime = React.forwardRef(({ className, date, format, children, ...props }, ref) => {
  const formattedDate = React.useMemo(() => {
    if (!date) return ''
    try {
      const dateObj = new Date(date)
      if (isNaN(dateObj.getTime())) return ''
      return new Intl.DateTimeFormat('en-US', {
        ...defaultDateFormat,
        timeZone: 'UTC',
        ...format
      }).format(dateObj)
    } catch (error) {
      console.error('Error formatting date:', error)
      return ''
    }
  }, [date, format])
  return (
    <time
      ref={ref}
      dateTime={date ? new Date(date).toISOString() : void 0}
      className={cn('text-sm font-medium tracking-tight text-gray-500', className)}
      {...props}
    >
      {children || formattedDate}
    </time>
  )
})
TimelineTime.displayName = 'TimelineTime'
const TimelineConnector = React.forwardRef(({ className, status = 'completed', color, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'w-0.5',
      (color === 'primary' || (!color && status === 'completed')) && 'bg-blue-600',
      (color === 'muted' || color === 'secondary' || (!color && status === 'pending')) && 'bg-gray-100',
      color === 'accent' && 'bg-blue-100',
      !color && status === 'in-progress' && 'bg-gradient-to-b from-blue-600 to-gray-100',
      className
    )}
    {...props}
  />
))
TimelineConnector.displayName = 'TimelineConnector'
const TimelineHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center gap-4', className)} {...props} />
))
TimelineHeader.displayName = 'TimelineHeader'
const TimelineTitle = React.forwardRef(({ className, children, ...props }, ref) => (
  <h3 ref={ref} className={cn('leading-none font-semibold tracking-tight text-gray-900', className)} {...props}>
    {children}
  </h3>
))
TimelineTitle.displayName = 'TimelineTitle'
const TimelineIcon = ({ icon, color = 'primary', status = 'completed', iconSize = 'md' }) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  }
  const iconSizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }
  const colorClasses = {
    primary: 'bg-blue-600 text-white',
    secondary: 'bg-gray-100 text-gray-900',
    muted: 'bg-gray-100 text-gray-500',
    accent: 'bg-blue-100 text-blue-900',
    destructive: 'bg-red-500 text-white'
  }
  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full shadow-sm ring-8 ring-white',
        sizeClasses[iconSize],
        colorClasses[color]
      )}
    >
      {icon ? (
        <div className={cn('flex items-center justify-center', iconSizeClasses[iconSize])}>{icon}</div>
      ) : (
        <div className={cn('rounded-full', iconSizeClasses[iconSize])} />
      )}
    </div>
  )
}
const TimelineDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('max-w-sm text-sm text-gray-500', className)} {...props} />
))
TimelineDescription.displayName = 'TimelineDescription'
const TimelineContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col gap-2 pl-2', className)} {...props} />
))
TimelineContent.displayName = 'TimelineContent'
const TimelineEmpty = React.forwardRef(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col items-center justify-center p-8 text-center', className)} {...props}>
    <p className="text-sm text-gray-500">{children || 'No timeline items to display'}</p>
  </div>
))
TimelineEmpty.displayName = 'TimelineEmpty'
export {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDescription,
  TimelineEmpty,
  TimelineHeader,
  TimelineIcon,
  TimelineItem,
  TimelineTime,
  TimelineTitle
}
