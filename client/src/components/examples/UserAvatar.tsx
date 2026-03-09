import UserAvatar from '../UserAvatar'

export default function UserAvatarExample() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Avatar Sizes</h3>
        <div className="flex items-center gap-6">
          <UserAvatar name="Alice Johnson" size="sm" />
          <UserAvatar name="Bob Smith" size="md" />
          <UserAvatar name="Charlie Brown" size="lg" />
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4">Online Status</h3>
        <div className="flex items-center gap-6">
          <UserAvatar name="Online User" showOnlineStatus isOnline={true} />
          <UserAvatar name="Offline User" showOnlineStatus isOnline={false} />
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4">With Badges</h3>
        <div className="flex items-center gap-6">
          <UserAvatar 
            name="Expert User" 
            showBadge 
            badgeText="Expert" 
            badgeVariant="default" 
          />
          <UserAvatar 
            name="Moderator" 
            showBadge 
            badgeText="Mod" 
            badgeVariant="destructive" 
          />
          <UserAvatar 
            name="New Member" 
            showBadge 
            badgeText="New" 
            badgeVariant="secondary" 
          />
        </div>
      </div>
    </div>
  )
}