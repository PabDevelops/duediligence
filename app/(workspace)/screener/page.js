import {redirect} from 'next/navigation';

// Old bookmarks remain usable without loading the retired dataset.
export default function RetiredScreener(){redirect('/search');}