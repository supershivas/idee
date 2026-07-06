# idee
Home-made note editor

## Configuration requise côté Supabase

**Synchronisation temps réel des notes (multi-onglets / multi-appareils).**
L'app s'abonne aux changements de la table `pages` via Supabase Realtime.
Pour que ça fonctionne, la table doit être ajoutée à la publication :

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE pages;
-- Optionnel mais recommandé pour propager les suppressions de façon fiable
-- entre appareils (sinon la ligne « old » d'un DELETE ne contient que l'id) :
ALTER TABLE pages REPLICA IDENTITY FULL;
```

Sans cette publication, l'app continue de fonctionner normalement mais les
modifications faites sur un autre appareil n'apparaissent pas en direct.

## Sécurité — actions recommandées côté Supabase

Ces points ne peuvent pas être corrigés dans le code de l'app et doivent
être appliqués dans le dashboard Supabase :

1. **Realtime sur `page_comments` (fuite `author_token`)** : les événements
   diffusent la ligne complète (colonne `author_token` incluse — c'est la
   preuve de propriété des commentaires) à tout client abonné au channel.
   Fermer la fuite en retirant la table de la publication :

   ```sql
   ALTER PUBLICATION supabase_realtime DROP TABLE page_comments;
   ```

   Conséquence : sur une page partagée, deux visiteurs simultanés ne verront
   plus apparaître **en direct** les commentaires de l'autre (il faut
   rafraîchir). Le chargement initial et ses propres actions restent
   instantanés.

2. **Buckets Storage `images` / `covers`** : ajouter une limite de taille et
   un filtre de type MIME côté serveur (le contrôle client, désormais en
   place, peut être contourné). Dans le dashboard Storage → bucket →
   Settings, ou en SQL :

   ```sql
   update storage.buckets
     set file_size_limit = 5242880,               -- 5 Mo
         allowed_mime_types = array['image/png','image/jpeg','image/gif','image/webp','image/svg+xml']
   where id in ('images', 'covers');
   ```

   Prévoir aussi un nettoyage périodique des fichiers orphelins (images
   supprimées avec leur note).

3. **Rate-limit `/api/summarize`** — ✅ **corrigé côté code**, nécessite une
   migration. Appliquer une fois `supabase/migrations/0001_rate_limits.sql`
   (SQL Editor) : elle crée la table `rate_limits` et la fonction
   `check_rate_limit`. La route l'utilise avec un repli *fail-open* (si la
   fonction n'est pas encore déployée, les requêtes passent au lieu
   d'échouer).
