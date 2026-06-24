import { supabase } from '../lib/supabase'
import { TABLE, STORAGE_BUCKET } from '../constants'

export async function fetchProfile(userId: string) {
  return supabase.from(TABLE.PROFILES).select('*').eq('id', userId).maybeSingle()
}

export async function createProfile(userId: string, name: string, email: string | null) {
  return supabase
    .from(TABLE.PROFILES)
    .insert({ id: userId, name: name.trim(), email })
    .select()
    .single()
}

export async function updateProfileName(userId: string, name: string) {
  return supabase
    .from(TABLE.PROFILES)
    .update({ name: name.trim() })
    .eq('id', userId)
    .select()
    .single()
}

export async function uploadAvatar(userId: string, file: File) {
  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/avatar.${ext}`
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET.AVATARS)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) return { publicUrl: null, error }
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET.AVATARS)
    .getPublicUrl(path)
  return { publicUrl: `${publicUrl}?t=${Date.now()}`, error: null }
}

export async function updateAvatarUrl(userId: string, avatarUrl: string) {
  return supabase
    .from(TABLE.PROFILES)
    .update({ avatar_url: avatarUrl })
    .eq('id', userId)
    .select()
    .single()
}
