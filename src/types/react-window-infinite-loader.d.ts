declare module 'react-window-infinite-loader' {
  import * as React from 'react';
  import { ListOnItemsRenderedProps } from 'react-window';

  export interface InfiniteLoaderChildProps {
    onItemsRendered: (props: ListOnItemsRenderedProps) => void;
    ref: React.Ref<any>;
  }

  export interface InfiniteLoaderProps {
    isItemLoaded: (index: number) => boolean;
    itemCount: number;
    loadMoreItems: (startIndex: number, stopIndex: number) => Promise<void> | void;
    children: (props: InfiniteLoaderChildProps) => React.ReactNode;
  }

  // Actual component
  export function InfiniteLoader(props: InfiniteLoaderProps): JSX.Element;

  export default InfiniteLoader;
}
