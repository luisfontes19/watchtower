# Sample bindings.gyp file for security testing.
# This includes patterns commonly associated with install-time command execution.
{
  "includes": ["./gyp/common.gypi"],
  "targets": [
    {
      "target_name": "native_stub",
      "type": "none",
      "sources": [
        "<!(node -e \"console.log('generate source')\")"
      ],
      "actions": [
        {
          "action_name": "prepare",
          "inputs": ["scripts/prepare.js"],
          "outputs": ["build/prepared.stamp"],
          "action": ["node", "scripts/prepare.js"]
        }
      ],
      "make_global_settings": [
        ["CC_wrapper", "./tooling/cc-wrapper.sh"]
      ]
    }
  ]
}
