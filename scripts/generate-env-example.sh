#!/usr/bin/env bash

set -euo pipefail

ENV_FILE=".env"
EXAMPLE_FILE=".env.example"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

: > "$EXAMPLE_FILE"

while IFS= read -r line || [[ -n "$line" ]]; do
  # 保留空行
  if [[ -z "$line" ]]; then
    echo "" >> "$EXAMPLE_FILE"
    continue
  fi

  # 保留整行注释
  if [[ "$line" =~ ^[[:space:]]*# ]]; then
    echo "$line" >> "$EXAMPLE_FILE"
    continue
  fi

  # 去掉行首空格，用于解析
  trimmed="$(echo "$line" | sed 's/^[[:space:]]*//')"

  # 支持 export KEY=value
  if [[ "$trimmed" == export\ * ]]; then
    trimmed="${trimmed#export }"
  fi

  # 只处理 KEY=value 格式
  if [[ "$trimmed" == *"="* ]]; then
    key="${trimmed%%=*}"
    value="${trimmed#*=}"

    # 去掉 key 两边空格
    key="$(echo "$key" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"

    # 尝试保留行尾注释，例如：
    # APP_PORT=3000 # server port
    inline_comment=""

    if [[ "$value" =~ [[:space:]]# ]]; then
      inline_comment="${value#* #}"
      inline_comment=" #${inline_comment}"
    fi

    # 只输出合法环境变量名
    if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      echo "${key}=${inline_comment}" >> "$EXAMPLE_FILE"
    fi
  fi
done < "$ENV_FILE"

echo "Generated $EXAMPLE_FILE"
