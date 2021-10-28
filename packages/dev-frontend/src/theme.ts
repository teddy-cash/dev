import { Theme, ThemeUIStyleObject } from "theme-ui";

// wyf does this exist? for some reason this library always sets
// the default mode to 'light'
export const getMode = (mode: string) => {
  return mode === "night" || mode === "light" ? "night" : "day";
};

const baseColors = {
  white: "#ffffff",
  blue: "#1542cd",
  darkBlue: "#293147",
  purple: "#745ddf",
  cyan: "#2eb6ea",
  lightBlue: "#84ddf6",
  lightBlueSemiTransparent: "rgba(122,199,240,0.4)",
  green: "#50cf3c",
  yellow: "#FFD700", //"#ffe27a",
  red: "#dc2c10",
  lightRed: "#ff755f",
  gray: "#9fa3b4",
  lightGray: "#eaebed",
  black: "#151517",
  lightBlack: "#23252c"
};

const colors = {
  primary: baseColors.white,
  secondary: baseColors.purple,
  accent: baseColors.cyan,
  success: baseColors.green,
  warning: baseColors.yellow,
  danger: baseColors.red,
  dangerHover: baseColors.lightRed,
  info: baseColors.blue,
  invalid: "pink",
  text: baseColors.gray,
  background: baseColors.black,
  muted: baseColors.lightGray,
  cardBorder: baseColors.lightBlack,
  cardHeader: baseColors.lightBlack,
  cardHeaderText: baseColors.lightBlue,
  button: baseColors.yellow,
  buttonText: "black",
  editorText: baseColors.white,
  outlineButtonBorder: baseColors.white,
  sidenav: "rgba(0, 0, 0, 0.9)",
  modes: {
    day: {
      color: baseColors.white,
      borderColor: "muted",
      primary: baseColors.blue,
      secondary: baseColors.purple,
      accent: baseColors.cyan,
      success: baseColors.green,
      warning: baseColors.yellow,
      danger: baseColors.red,
      dangerHover: baseColors.lightRed,
      info: baseColors.blue,
      invalid: "pink",
      text: baseColors.darkBlue,
      background: "white",
      muted: baseColors.lightGray,
      cardBorder: baseColors.lightGray,
      cardHeader: baseColors.lightGray,
      cardHeaderText: "black",
      button: baseColors.blue,
      buttonText: "white",
      buttonBorder: baseColors.blue,
      editorText: baseColors.black,
      outlineButtonBorder: baseColors.black,
      sidenav: "rgba(255, 255, 255, 0.9)"
    }
  }
};

const buttonBase: ThemeUIStyleObject = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  ":enabled": { cursor: "pointer" }
};

const button: ThemeUIStyleObject = {
  ...buttonBase,

  px: "32px",
  py: "12px",

  color: "buttonText",
  border: 1,

  fontWeight: "bold",

  ":disabled": {
    opacity: 0.5
  }
};

const buttonOutline = (color: string, hoverColor: string): ThemeUIStyleObject => ({
  color,
  borderColor: color,
  background: "none",

  ":enabled:hover": {
    opacity: 0.8
  }
});

const iconButton: ThemeUIStyleObject = {
  ...buttonBase,

  padding: 0,
  width: "40px",
  height: "40px",

  background: "none",

  ":disabled": {
    color: "text",
    opacity: 0.25
  }
};

const cardHeadingFontSize = 18.7167;

const cardGapX = [0, 3, 4];
const cardGapY = [3, 3, 4];

const card: ThemeUIStyleObject = {
  position: "relative",
  mt: cardGapY,
  border: 1,
  boxShadow: [1, null, 2]
};

const infoCard: ThemeUIStyleObject = {
  ...card,

  padding: 3,

  borderColor: "cardBorder",
  bg: "background",
  borderRadius: "16px",

  h2: {
    mt: 2,
    mb: 3,
    fontSize: cardHeadingFontSize,
    color: "cardHeaderText",
    bg: "none"
  }
};

const formBase: ThemeUIStyleObject = {
  display: "block",
  width: "auto",
  flexShrink: 0,
  padding: 2,
  fontSize: 3
};

const formCell: ThemeUIStyleObject = {
  ...formBase,

  bg: "background",
  border: 1,
  borderColor: "muted",
  borderRadius: "4px",
  boxShadow: [1, 2]
};

const overlay: ThemeUIStyleObject = {
  position: "absolute",

  left: 0,
  top: 0,
  width: "100%",
  height: "100%"
};

const modalOverlay: ThemeUIStyleObject = {
  position: "fixed",

  left: 0,
  top: 0,
  width: "100vw",
  height: "100vh"
};

/* const headerGradient: ThemeUIStyleObject = {
  background: colors.background
};
 */
const theme: Theme = {
  breakpoints: ["48em", "52em", "64em"],

  space: [0, 4, 8, 16, 32, 64, 128, 256, 512],

  fonts: {
    body: [
      "system-ui",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "sans-serif"
    ].join(", "),
    heading: "inherit",
    monospace: "Menlo, monospace"
  },

  fontSizes: [12, 14, 16, 20, 24, 32, 48, 64, 96],

  fontWeights: {
    body: 400,
    heading: 600,

    light: 200,
    medium: 500,
    bold: 600
  },

  lineHeights: {
    body: 1.5,
    heading: 1.25
  },

  config: {
    initialColorModeName: "night"
  },

  colors: colors,
  /* colors, */

  borders: [0, "1px solid", "2px solid"],

  shadows: ["0", "0px 4px 8px rgba(41, 49, 71, 0.1)", "0px 8px 16px rgba(41, 49, 71, 0.1)"],

  text: {
    address: {
      fontFamily: "monospace",
      fontSize: 1
    }
  },

  buttons: {
    primary: {
      ...button,

      bg: "button",
      color: "buttonText",
      borderColor: "buttonBorder",

      ":enabled:hover": {
        opacity: 0.8
      }
    },

    outline: {
      ...button,
      ...buttonOutline("outlineButtonBorder", "yellow")
    },

    cancel: {
      ...button,
      ...buttonOutline("outlineButtonBorder", "black")
    },

    danger: {
      ...button,

      bg: "danger",
      borderColor: "danger",

      ":enabled:hover": {
        bg: "dangerHover",
        borderColor: "dangerHover"
      }
    },

    icon: {
      ...iconButton,
      color: "primary",
      ":enabled:hover": { color: "accent" }
    },

    dangerIcon: {
      ...iconButton,
      color: "danger",
      ":enabled:hover": { color: "dangerHover" }
    },

    titleIcon: {
      ...iconButton,
      color: "text",
      ":enabled:hover": { color: "success" }
    }
  },

  cards: {
    primary: {
      ...card,

      padding: 0,

      borderColor: "cardBorder",
      bg: "background",
      borderRadius: "16px",
      color: "text",

      "> h2": {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",

        height: "56px",

        pl: 3,
        py: 2,
        pr: 2,

        mt: 0,
        borderRadius: "16px 16px 0 0",
        bg: "cardHeader",
        color: "cardHeaderText", //"#62c5e1",
        fontSize: cardHeadingFontSize
      }
    },

    info: {
      ...infoCard,

      display: ["none", "block"]
    },

    infoPopup: {
      ...infoCard,

      color: "white",
      position: "fixed",
      top: 0,
      right: 3,
      left: 3,
      mt: "72px",
      height: "80%",
      overflowY: "scroll"
    },

    tooltip: {
      padding: 2,

      border: 1,
      borderColor: "muted",
      borderRadius: "4px",
      bg: "background",
      boxShadow: 2,

      fontSize: 1,
      color: "text",
      fontWeight: "body",
      zIndex: 1
    }
  },

  forms: {
    label: {
      ...formBase
    },

    unit: {
      ...formCell,

      textAlign: "center",
      bg: "muted"
    },

    input: {
      ...formCell,

      flex: 1
    },

    editor: {}
  },

  layout: {
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "stretch",

      position: ["fixed", "relative"],
      width: "100vw",
      top: 0,
      zIndex: 1,

      px: [2, "12px", "12px", 5],
      py: [2, "12px", "12px"],
      bg: "background",
      /* ...headerGradient, */
      boxShadow: [1, "none"]
    },

    footer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",

      mt: cardGapY,
      px: 3,
      minHeight: "72px",

      bg: "muted"
    },

    main: {
      width: "100%",
      maxWidth: "912px",
      mx: "auto",
      mt: ["40px", 0],
      mb: ["40px", "40px"],
      px: cardGapX
    },

    columns: {
      display: "flex",
      flexWrap: "wrap",
      justifyItems: "center"
    },

    left: {
      pr: cardGapX,
      width: ["100%", "58%"]
    },

    right: {
      width: ["100%", "42%"]
    },

    actions: {
      justifyContent: "flex-end",
      mt: 2,

      button: {
        ml: 2
      }
    },

    disabledOverlay: {
      ...overlay,

      bg: "rgba(255, 255, 255, 0.5)"
    },

    modalOverlay: {
      ...modalOverlay,

      bg: "rgba(0, 0, 0, 0.8)",

      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    },

    modal: {
      padding: 3,
      width: ["100%", "40em"]
    },

    infoOverlay: {
      ...modalOverlay,

      display: ["block", "none"],

      bg: "rgba(255, 255, 255, 0.9)"
    },

    infoMessage: {
      display: "flex",
      justifyContent: "center",
      m: 3,
      alignItems: "center",
      minWidth: "128px"
    },

    sidenav: {
      display: ["flex", "none"],
      flexDirection: "column",
      p: 0,
      m: 0,
      borderColor: "muted",
      mr: "25vw",
      height: "100%",
      bg: "sidenav",
      text: "text"
    },

    badge: {
      border: 0,
      borderRadius: 3,
      p: 1,
      px: 2,
      backgroundColor: "muted",
      color: "slate",
      fontSize: 1,
      fontWeight: "body"
    }
  },

  styles: {
    root: {
      fontFamily: "body",
      lineHeight: "body",
      fontWeight: "body",

      height: "100%",

      "#root": {
        height: "100%"
      }
    },

    a: {
      color: "primary",
      ":hover": { color: "accent" },
      textDecoration: "none",
      fontWeight: "bold"
    }
  },

  links: {
    nav: {
      px: 2,
      py: 1,
      fontWeight: "medium",
      fontSize: 2,
      textTransform: "uppercase",
      letterSpacing: "2px",
      width: ["100%", "auto"],
      mt: [3, "auto"]
    }
  }
};

export default theme;
