#!/usr/bin/env bash

set -euo pipefail

readonly API_BASE_URL="${CONTENTFUL_CMA_BASE_URL:-https://api.contentful.com}"
readonly CONTENTFUL_SPACE_ID="${CONTENTFUL_SPACE_ID:-${SPACE_ID:-}}"
readonly CONTENTFUL_ENVIRONMENT_ID="${CONTENTFUL_ENVIRONMENT_ID:-${ENVIRONMENT_ID:-master}}"
readonly CONTENTFUL_MANAGEMENT_TOKEN="${CONTENTFUL_MANAGEMENT_TOKEN:-${MANAGEMENT_TOKEN:-}}"

usage() {
  cat <<'EOF'
Usage:
  CONTENTFUL_SPACE_ID=... CONTENTFUL_MANAGEMENT_TOKEN=... ./scripts/setup-contentful-model.sh

Required environment variables:
  CONTENTFUL_SPACE_ID          Contentful space ID
  CONTENTFUL_MANAGEMENT_TOKEN  Contentful personal access token / management token

Optional environment variables:
  CONTENTFUL_ENVIRONMENT_ID    Environment ID to manage (default: master)
  CONTENTFUL_CMA_BASE_URL      Override API base URL (default: https://api.contentful.com)

Notes:
  - This script upserts and publishes the content types used by this repo.
  - Re-running it updates those managed content types to match this script.
  - It does not create content entries; it only provisions the content model.
EOF
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

require_env() {
  local env_name="$1"
  local env_value="$2"
  if [[ -z "$env_value" ]]; then
    echo "Missing required environment variable: $env_name" >&2
    exit 1
  fi
}

api_request() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"
  local version="${4:-}"
  local body_file
  local status
  local -a curl_args

  body_file="$(mktemp)"
  curl_args=(
    -sS
    -X "$method"
    -H "Authorization: Bearer $CONTENTFUL_MANAGEMENT_TOKEN"
    -H "Content-Type: application/vnd.contentful.management.v1+json"
    -o "$body_file"
    -w "%{http_code}"
  )

  if [[ -n "$version" ]]; then
    curl_args+=(-H "X-Contentful-Version: $version")
  fi

  if [[ -n "$payload" ]]; then
    curl_args+=(--data "$payload")
  fi

  status="$(curl "${curl_args[@]}" "${API_BASE_URL}${path}")"

  if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
    echo "Contentful API request failed: $method $path ($status)" >&2
    jq . "$body_file" >&2 2>/dev/null || cat "$body_file" >&2
    rm -f "$body_file"
    exit 1
  fi

  cat "$body_file"
  rm -f "$body_file"
}

get_content_type() {
  local content_type_id="$1"
  local body_file
  local status

  body_file="$(mktemp)"
  status="$(
    curl -sS \
      -H "Authorization: Bearer $CONTENTFUL_MANAGEMENT_TOKEN" \
      -H "Content-Type: application/vnd.contentful.management.v1+json" \
      -o "$body_file" \
      -w "%{http_code}" \
      "${API_BASE_URL}/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT_ID}/content_types/${content_type_id}"
  )"

  case "$status" in
    200)
      cat "$body_file"
      rm -f "$body_file"
      return 0
      ;;
    404)
      rm -f "$body_file"
      return 1
      ;;
    *)
      echo "Failed to fetch content type '${content_type_id}' ($status)" >&2
      jq . "$body_file" >&2 2>/dev/null || cat "$body_file" >&2
      rm -f "$body_file"
      exit 1
      ;;
  esac
}

publish_content_type() {
  local content_type_id="$1"
  local version="$2"

  api_request \
    PUT \
    "/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT_ID}/content_types/${content_type_id}/published" \
    "" \
    "$version" >/dev/null
}

upsert_content_type() {
  local content_type_id="$1"
  local payload="$2"
  local existing_content_type=""
  local version=""
  local response
  local published_version

  if existing_content_type="$(get_content_type "$content_type_id")"; then
    version="$(jq -r '.sys.version' <<<"$existing_content_type")"
    echo "Updating content type: $content_type_id"
  else
    echo "Creating content type: $content_type_id"
  fi

  response="$(
    api_request \
      PUT \
      "/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT_ID}/content_types/${content_type_id}" \
      "$payload" \
      "$version"
  )"

  published_version="$(jq -r '.sys.version' <<<"$response")"
  publish_content_type "$content_type_id" "$published_version"
  echo "Published content type: $content_type_id"
}

build_seo_payload() {
  jq -n '
    {
      name: "SEO",
      description: "Reusable SEO metadata entry for pages and posts.",
      displayField: "title",
      fields: [
        {
          id: "title",
          name: "Title",
          type: "Symbol",
          required: true
        },
        {
          id: "description",
          name: "Description",
          type: "Text",
          required: true
        },
        {
          id: "ogImageTitle",
          name: "Open Graph Title",
          type: "Symbol",
          required: false
        },
        {
          id: "ogImageSubtitle",
          name: "Open Graph Subtitle",
          type: "Symbol",
          required: false
        },
        {
          id: "keywords",
          name: "Keywords",
          type: "Array",
          required: false,
          items: {
            type: "Symbol",
            validations: [
              {
                size: {
                  max: 60
                }
              }
            ]
          }
        }
      ]
    }
  '
}

build_content_embed_payload() {
  jq -n '
    {
      name: "Content Embed",
      description: "Inline embeds for rich text content.",
      displayField: "title",
      fields: [
        {
          id: "title",
          name: "Title",
          type: "Symbol",
          required: false
        },
        {
          id: "embedUrl",
          name: "Embed URL",
          type: "Symbol",
          required: true
        },
        {
          id: "type",
          name: "Type",
          type: "Symbol",
          required: true,
          validations: [
            {
              in: ["Video", "SoundCloud"]
            }
          ]
        }
      ]
    }
  '
}

build_code_block_payload() {
  jq -n '
    {
      name: "Code Block",
      description: "Inline code snippet entry for rich text content.",
      displayField: "title",
      fields: [
        {
          id: "title",
          name: "Title",
          type: "Symbol",
          required: false
        },
        {
          id: "code",
          name: "Code",
          type: "Text",
          required: true
        }
      ]
    }
  '
}

build_tweet_payload() {
  jq -n '
    {
      name: "Tweet",
      description: "Inline tweet reference for rich text content.",
      displayField: "id",
      fields: [
        {
          id: "id",
          name: "Tweet ID",
          type: "Symbol",
          required: true
        }
      ]
    }
  '
}

build_carousel_payload() {
  jq -n '
    {
      name: "Carousel",
      description: "Inline image carousel for rich text content.",
      displayField: "title",
      fields: [
        {
          id: "title",
          name: "Title",
          type: "Symbol",
          required: false
        },
        {
          id: "images",
          name: "Images",
          type: "Array",
          required: true,
          items: {
            type: "Link",
            linkType: "Asset",
            validations: []
          }
        }
      ]
    }
  '
}

build_page_payload() {
  jq -n '
    {
      name: "Page",
      description: "Generic page entry for /[slug] routes.",
      displayField: "title",
      fields: [
        {
          id: "title",
          name: "Title",
          type: "Symbol",
          required: true
        },
        {
          id: "slug",
          name: "Slug",
          type: "Symbol",
          required: true,
          validations: [
            {
              unique: true
            },
            {
              regexp: {
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
                flags: null
              },
              message: "Use lowercase kebab-case slugs."
            }
          ]
        },
        {
          id: "hasCustomPage",
          name: "Has Custom Page",
          type: "Boolean",
          required: false
        },
        {
          id: "seo",
          name: "SEO",
          type: "Link",
          linkType: "Entry",
          required: true,
          validations: [
            {
              linkContentType: ["seo"]
            }
          ]
        },
        {
          id: "content",
          name: "Content",
          type: "RichText",
          required: true
        }
      ]
    }
  '
}

build_post_payload() {
  jq -n '
    {
      name: "Post",
      description: "Writing entry rendered at /writing/[slug].",
      displayField: "title",
      fields: [
        {
          id: "title",
          name: "Title",
          type: "Symbol",
          required: true
        },
        {
          id: "slug",
          name: "Slug",
          type: "Symbol",
          required: true,
          validations: [
            {
              unique: true
            },
            {
              regexp: {
                pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
                flags: null
              },
              message: "Use lowercase kebab-case slugs."
            }
          ]
        },
        {
          id: "date",
          name: "Date",
          type: "Date",
          required: false
        },
        {
          id: "seo",
          name: "SEO",
          type: "Link",
          linkType: "Entry",
          required: true,
          validations: [
            {
              linkContentType: ["seo"]
            }
          ]
        },
        {
          id: "content",
          name: "Content",
          type: "RichText",
          required: true
        }
      ]
    }
  '
}

build_logbook_payload() {
  jq -n '
    {
      name: "Logbook",
      description: "Journey timeline entry rendered on /journey.",
      displayField: "title",
      fields: [
        {
          id: "title",
          name: "Title",
          type: "Symbol",
          required: true
        },
        {
          id: "date",
          name: "Date",
          type: "Date",
          required: true
        },
        {
          id: "description",
          name: "Description",
          type: "Text",
          required: true
        },
        {
          id: "images",
          name: "Images",
          type: "Array",
          required: false,
          items: {
            type: "Link",
            linkType: "Asset",
            validations: []
          }
        }
      ]
    }
  '
}

main() {
  if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    usage
    exit 0
  fi

  require_command curl
  require_command jq
  require_env CONTENTFUL_SPACE_ID "$CONTENTFUL_SPACE_ID"
  require_env CONTENTFUL_MANAGEMENT_TOKEN "$CONTENTFUL_MANAGEMENT_TOKEN"

  echo "Provisioning Contentful model in space '${CONTENTFUL_SPACE_ID}' environment '${CONTENTFUL_ENVIRONMENT_ID}'"

  upsert_content_type "seo" "$(build_seo_payload)"
  upsert_content_type "contentEmbed" "$(build_content_embed_payload)"
  upsert_content_type "codeBlock" "$(build_code_block_payload)"
  upsert_content_type "tweet" "$(build_tweet_payload)"
  upsert_content_type "carousel" "$(build_carousel_payload)"
  upsert_content_type "page" "$(build_page_payload)"
  upsert_content_type "post" "$(build_post_payload)"
  upsert_content_type "logbook" "$(build_logbook_payload)"

  echo "Contentful content model is ready."
}

main "$@"
