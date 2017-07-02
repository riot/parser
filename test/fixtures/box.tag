<content class="container">
  <div class="box" align="center">
    <h1>{box.title}</h1>
    <img src={box.image} width="480" />
    <div class="body">
      <h2>Escaped \{0}</h2>
      <p>Body: {box.body}</p>
      <pre>
        Do not trim <span>this</span>
      </pre>
    </div>
  </div>
  <p/>

  <style type="less">
    pre {
      span: { font-weight: bolder }
    }
  </style>

  <script>
  this.box = {
      title: "Good morning!",
      image: "http://trinixy.ru/pics5/20130614/podb_07.jpg",
      body: "It is when SO!"
  }
  </script>

</content>
