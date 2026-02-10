-- Group chat messages (visible to all trip members)
CREATE TABLE group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  shared_from_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  shared_action_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_group_messages_trip ON group_messages(trip_id, created_at);

-- Emoji reactions on group messages
CREATE TABLE message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES group_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_message_reactions_message ON message_reactions(message_id);

-- Add last_active_at for presence persistence
ALTER TABLE trip_members ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- RLS
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- group_messages policies
CREATE POLICY "Trip members can read group messages"
  ON group_messages FOR SELECT
  USING (is_trip_member(trip_id));

CREATE POLICY "Trip members can insert group messages"
  ON group_messages FOR INSERT
  WITH CHECK (is_trip_member(trip_id) AND user_id = auth.uid());

CREATE POLICY "Users can delete own group messages"
  ON group_messages FOR DELETE
  USING (user_id = auth.uid());

-- message_reactions policies
CREATE POLICY "Trip members can read reactions"
  ON message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_messages gm
      WHERE gm.id = message_reactions.message_id
      AND is_trip_member(gm.trip_id)
    )
  );

CREATE POLICY "Authenticated users can add reactions"
  ON message_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove own reactions"
  ON message_reactions FOR DELETE
  USING (user_id = auth.uid());

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
