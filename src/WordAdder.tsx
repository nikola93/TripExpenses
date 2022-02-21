import React from "react";

class ListOfWords extends React.Component<StateProps> {
  render() {
    return <div>{this.props.words.join(",")}</div>;
  }
}

interface StateProps {
  words: string[];
}

export class WordAdder extends React.Component<StateProps, StateProps> {
  constructor(props: StateProps) {
    super(props);
    this.state = {
      words: ["marklar"],
    };
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    // This section is bad style and causes a bug
    // const words = this.state.words;

    //here we are directly changing the props.old, so new == old, ergo, no re-render
    // words.push("marklar");

    //because now props.old is not changed (state.words)
    this.setState({ words: [...this.state.words, "marklar"] });
  }

  render() {
    return (
      <div>
        <button onClick={this.handleClick}>Click </button>
        <ListOfWords words={this.state.words} />
      </div>
    );
  }
}
