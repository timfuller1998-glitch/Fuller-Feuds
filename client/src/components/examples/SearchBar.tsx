import SearchBar from '../SearchBar'

export default function SearchBarExample() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Search Bar - Default</h3>
        <SearchBar onSearch={(query) => console.log('Searched:', query)} />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Search Bar - Custom Placeholder</h3>
        <SearchBar 
          placeholder="Find controversial topics..." 
          onSearch={(query) => console.log('Custom search:', query)} 
        />
      </div>
    </div>
  )
}